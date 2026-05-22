import fs from "node:fs"
import * as http2 from "node:http2"

import admin from "firebase-admin"
import jwt from "jsonwebtoken"

const FIREBASE_TRANSIENT_CODES = new Set([
  "app/network-error",
  "messaging/internal-error",
  "messaging/server-unavailable",
  "messaging/message-rate-exceeded",
])

const FIREBASE_INVALID_CODES = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
])

const APNS_TRANSIENT_REASONS = new Set([
  "InternalServerError",
  "ServiceUnavailable",
  "Shutdown",
  "TooManyRequests",
])

const APNS_INVALID_REASONS = new Set([
  "BadDeviceToken",
  "DeviceTokenNotForTopic",
  "TopicDisallowed",
  "Unregistered",
])

let firebaseApp = null
let cachedApnsJwt = null
let cachedApnsJwtIssuedAt = 0

class PushDispatchError extends Error {
  constructor(message, metadata = {}) {
    super(message)
    this.name = "PushDispatchError"
    this.retryable = Boolean(metadata.retryable)
    this.invalidToken = Boolean(metadata.invalidToken)
    this.code = metadata.code || null
    this.provider = metadata.provider || null
    this.details = metadata.details || null
    this.statusCode = metadata.statusCode || null
  }
}

function normalizePrivateKey(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .trim()
}

function getFirebaseServiceAccount() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON.trim()
    return JSON.parse(rawJson)
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const decoded = Buffer.from(
      process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
      "base64",
    ).toString("utf8")
    return JSON.parse(decoded)
  }

  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    return {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY),
    }
  }

  return null
}

function getFirebaseMessaging() {
  const serviceAccount = getFirebaseServiceAccount()

  if (!serviceAccount) {
    throw new PushDispatchError("Firebase service account is not configured", {
      provider: "FCM",
      code: "FCM_CONFIG_MISSING",
    })
  }

  if (!firebaseApp) {
    firebaseApp = admin.apps.length
      ? admin.app()
      : admin.initializeApp({
          credential: admin.credential.cert({
            projectId: serviceAccount.projectId,
            clientEmail: serviceAccount.clientEmail,
            privateKey: normalizePrivateKey(serviceAccount.privateKey),
          }),
        })
  }

  return firebaseApp.messaging()
}

function getApnsConfig() {
  const privateKeyFromEnv = normalizePrivateKey(process.env.APNS_PRIVATE_KEY)
  const privateKeyPath = String(process.env.APNS_PRIVATE_KEY_PATH || "").trim()
  const privateKeyFromPath =
    privateKeyPath && fs.existsSync(privateKeyPath)
      ? fs.readFileSync(privateKeyPath, "utf8").trim()
      : ""

  const config = {
    keyId: String(process.env.APNS_KEY_ID || "").trim(),
    teamId: String(process.env.APNS_TEAM_ID || "").trim(),
    privateKey: privateKeyFromEnv || privateKeyFromPath,
    bundleId: String(
      process.env.APNS_BUNDLE_ID ||
        process.env.IOS_BUNDLE_IDENTIFIER ||
        process.env.APPLE_BUNDLE_ID ||
        "",
    ).trim(),
    useProduction:
      String(process.env.APNS_USE_PRODUCTION || "false").toLowerCase() ===
      "true",
  }

  if (
    !config.keyId ||
    !config.teamId ||
    !config.privateKey ||
    !config.bundleId
  ) {
    throw new PushDispatchError("APNS credentials are not fully configured", {
      provider: "APNS",
      code: "APNS_CONFIG_MISSING",
    })
  }

  return config
}

function getApnsJwt(config) {
  const now = Date.now()

  if (cachedApnsJwt && now - cachedApnsJwtIssuedAt < 50 * 60 * 1000) {
    return cachedApnsJwt
  }

  cachedApnsJwt = jwt.sign(
    {
      iss: config.teamId,
      iat: Math.floor(now / 1000),
    },
    config.privateKey,
    {
      algorithm: "ES256",
      header: {
        alg: "ES256",
        kid: config.keyId,
      },
    },
  )
  cachedApnsJwtIssuedAt = now
  return cachedApnsJwt
}

function stringifyPushData(data = {}) {
  return Object.entries(data).reduce((accumulator, [key, value]) => {
    if (value === undefined || value === null) {
      return accumulator
    }

    accumulator[key] = typeof value === "string" ? value : JSON.stringify(value)

    return accumulator
  }, {})
}

function normalizeFirebaseError(error) {
  const code = error?.code || "FCM_SEND_FAILED"
  return new PushDispatchError(error?.message || "FCM send failed", {
    provider: "FCM",
    code,
    retryable: FIREBASE_TRANSIENT_CODES.has(code),
    invalidToken: FIREBASE_INVALID_CODES.has(code),
    details: error,
  })
}

function normalizeApnsError(statusCode, responseBody) {
  let payload = {}

  if (typeof responseBody === "string" && responseBody.trim().length > 0) {
    try {
      payload = JSON.parse(responseBody)
    } catch (_error) {
      payload = {
        reason: responseBody,
      }
    }
  }
  const code = payload?.reason || `APNS_${statusCode || "UNKNOWN"}`

  return new PushDispatchError(payload?.reason || "APNS send failed", {
    provider: "APNS",
    code,
    statusCode,
    retryable:
      statusCode === 429 ||
      statusCode >= 500 ||
      APNS_TRANSIENT_REASONS.has(code),
    invalidToken:
      statusCode === 410 ||
      statusCode === 400 ||
      APNS_INVALID_REASONS.has(code),
    details: payload,
  })
}

async function sendFcmNotification({
  pushToken,
  title,
  body,
  data = {},
  badgeCount,
}) {
  try {
    const messaging = getFirebaseMessaging()
    const messageId = await messaging.send({
      token: pushToken.token,
      notification: {
        title,
        body,
      },
      data: stringifyPushData(data),
      android: {
        priority: "high",
        notification: {
          channelId: process.env.ANDROID_NOTIFICATION_CHANNEL_ID || "default",
          sound: "default",
          notificationCount:
            Number.isInteger(badgeCount) && badgeCount >= 0
              ? badgeCount
              : undefined,
        },
      },
    })

    return {
      provider: "FCM",
      messageId,
      response: {
        messageId,
      },
    }
  } catch (error) {
    throw normalizeFirebaseError(error)
  }
}

async function sendApnsNotification({
  pushToken,
  title,
  body,
  data = {},
  badgeCount,
}) {
  const config = getApnsConfig()
  const jwtToken = getApnsJwt(config)
  const host = config.useProduction
    ? "api.push.apple.com"
    : "api.sandbox.push.apple.com"
  const payload = {
    aps: {
      alert: {
        title,
        body,
      },
      sound: "default",
      ...(Number.isInteger(badgeCount) && badgeCount >= 0
        ? {
            badge: badgeCount,
          }
        : {}),
    },
    ...stringifyPushData(data),
  }

  return new Promise((resolve, reject) => {
    const client = http2.connect(`https://${host}`)
    let statusCode = 0
    let responseHeaders = {}
    let responseBody = ""
    let settled = false

    const fail = (error) => {
      if (settled) {
        return
      }

      settled = true
      client.close()
      reject(error)
    }

    client.on("error", (error) => {
      fail(
        new PushDispatchError(error.message || "APNS connection failed", {
          provider: "APNS",
          code: "APNS_CONNECTION_ERROR",
          retryable: true,
          details: error,
        }),
      )
    })

    const request = client.request({
      ":method": "POST",
      ":path": `/3/device/${pushToken.token}`,
      authorization: `bearer ${jwtToken}`,
      "apns-topic": config.bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    })

    request.setEncoding("utf8")

    request.on("response", (headers) => {
      responseHeaders = headers
      statusCode = Number(headers[":status"] || 0)
    })

    request.on("data", (chunk) => {
      responseBody += chunk
    })

    request.on("end", () => {
      if (settled) {
        return
      }

      settled = true
      client.close()

      if (statusCode >= 200 && statusCode < 300) {
        resolve({
          provider: "APNS",
          messageId: String(responseHeaders["apns-id"] || ""),
          response: {
            statusCode,
            apnsId: responseHeaders["apns-id"] || null,
          },
        })
        return
      }

      try {
        reject(normalizeApnsError(statusCode, responseBody))
      } catch (error) {
        reject(
          new PushDispatchError("APNS send failed", {
            provider: "APNS",
            code: "APNS_SEND_FAILED",
            retryable: statusCode >= 500,
            details: {
              statusCode,
              responseBody,
            },
          }),
        )
      }
    })

    request.on("error", (error) => {
      fail(
        new PushDispatchError(error.message || "APNS request failed", {
          provider: "APNS",
          code: "APNS_REQUEST_ERROR",
          retryable: true,
          details: error,
        }),
      )
    })

    request.end(JSON.stringify(payload))
  })
}

async function sendPushNotification({
  pushToken,
  title,
  body,
  data = {},
  badgeCount,
}) {
  if (!pushToken?.token) {
    throw new PushDispatchError("Push token is missing", {
      code: "TOKEN_MISSING",
    })
  }

  if (pushToken.tokenType === "APNS") {
    return sendApnsNotification({
      pushToken,
      title,
      body,
      data,
      badgeCount,
    })
  }

  return sendFcmNotification({
    pushToken,
    title,
    body,
    data,
    badgeCount,
  })
}

export { PushDispatchError, sendPushNotification }
