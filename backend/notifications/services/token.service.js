import { getPrismaClient } from "../../config/prisma.js"

const prisma = getPrismaClient()

const PUSH_PLATFORMS = new Set(["android", "ios"])
const PUSH_TOKEN_TYPES = new Set(["FCM", "APNS"])

function normalizePlatform(platform) {
  const normalized = String(platform || "")
    .trim()
    .toLowerCase()

  if (!PUSH_PLATFORMS.has(normalized)) {
    throw new Error("platform must be android or ios")
  }

  return normalized
}

function normalizeTokenType(tokenType, platform) {
  if (!tokenType) {
    return platform === "ios" ? "APNS" : "FCM"
  }

  const normalized = String(tokenType || "")
    .trim()
    .toUpperCase()

  if (!PUSH_TOKEN_TYPES.has(normalized)) {
    throw new Error("tokenType must be FCM or APNS")
  }

  if (platform === "android" && normalized !== "FCM") {
    throw new Error("Android devices must register FCM tokens")
  }

  if (platform === "ios" && normalized !== "APNS") {
    throw new Error("iOS devices must register APNS tokens")
  }

  return normalized
}

function validateTokenFormat(token, tokenType) {
  const normalizedToken = String(token || "").trim()

  if (!normalizedToken) {
    throw new Error("token is required")
  }

  if (tokenType === "APNS") {
    if (!/^[a-fA-F0-9]{64,200}$/.test(normalizedToken)) {
      throw new Error("Invalid APNS token format")
    }
    return normalizedToken
  }

  if (normalizedToken.length < 20) {
    throw new Error("Invalid FCM token format")
  }

  return normalizedToken
}

function normalizeDeviceRegistration(input) {
  const platform = normalizePlatform(input.platform)
  const tokenType = normalizeTokenType(input.tokenType, platform)
  const token = validateTokenFormat(input.token, tokenType)
  const deviceId = String(input.deviceId || "")
    .trim()
    .slice(0, 128)

  if (!deviceId) {
    throw new Error("deviceId is required")
  }

  return {
    token,
    tokenType,
    platform,
    deviceId,
    deviceName:
      String(input.deviceName || "")
        .trim()
        .slice(0, 255) || null,
    appVersion:
      String(input.appVersion || "")
        .trim()
        .slice(0, 50) || null,
    buildNumber:
      String(input.buildNumber || "")
        .trim()
        .slice(0, 50) || null,
  }
}

async function savePushToken({ userId, ...payload }) {
  if (!userId) {
    throw new Error("userId is required")
  }

  const normalized = normalizeDeviceRegistration(payload)
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const [existingByDevice, existingByToken] = await Promise.all([
      tx.pushToken.findUnique({
        where: {
          deviceId: normalized.deviceId,
        },
      }),
      tx.pushToken.findUnique({
        where: {
          token: normalized.token,
        },
      }),
    ])

    if (
      existingByDevice &&
      existingByToken &&
      existingByDevice.id !== existingByToken.id
    ) {
      await tx.pushToken.update({
        where: {
          id: existingByDevice.id,
        },
        data: {
          isActive: false,
          status: "STALE",
          invalidReason: "superseded_by_matching_token",
          lastSeenAt: now,
        },
      })
    }

    const targetRecord = existingByToken || existingByDevice

    const data = {
      userId,
      token: normalized.token,
      tokenType: normalized.tokenType,
      platform: normalized.platform,
      deviceId: normalized.deviceId,
      deviceName: normalized.deviceName,
      appVersion: normalized.appVersion,
      buildNumber: normalized.buildNumber,
      isActive: true,
      status: "ACTIVE",
      invalidReason: null,
      lastRegisteredAt: now,
      lastSeenAt: now,
    }

    const currentToken = targetRecord
      ? await tx.pushToken.update({
          where: {
            id: targetRecord.id,
          },
          data,
        })
      : await tx.pushToken.create({
          data: {
            ...data,
          },
        })

    await tx.pushToken.updateMany({
      where: {
        userId,
        isActive: true,
        status: "ACTIVE",
        id: {
          not: currentToken.id,
        },
      },
      data: {
        isActive: false,
        status: "LOGGED_OUT",
        invalidReason: "single_device_policy_replaced",
        lastSeenAt: now,
      },
    })

    return currentToken
  })
}

async function deactivatePushToken({
  userId,
  deviceId,
  token,
  reason = "user_logout",
}) {
  if (!userId) {
    throw new Error("userId is required")
  }

  const where = {
    userId,
    isActive: true,
  }

  if (deviceId) {
    where.deviceId = String(deviceId).trim()
  }

  if (token) {
    where.token = String(token).trim()
  }

  return prisma.pushToken.updateMany({
    where,
    data: {
      isActive: false,
      status: "LOGGED_OUT",
      invalidReason: reason,
      lastSeenAt: new Date(),
    },
  })
}

async function invalidatePushToken(pushTokenId, reason) {
  if (!pushTokenId) {
    return null
  }

  return prisma.pushToken.update({
    where: {
      id: pushTokenId,
    },
    data: {
      isActive: false,
      status: "INVALID",
      invalidReason: String(reason || "provider_invalid_token"),
      lastFailureAt: new Date(),
    },
  })
}

async function markPushTokenDelivered(pushTokenId) {
  if (!pushTokenId) {
    return null
  }

  return prisma.pushToken.update({
    where: {
      id: pushTokenId,
    },
    data: {
      isActive: true,
      status: "ACTIVE",
      invalidReason: null,
      lastDeliveredAt: new Date(),
      lastSeenAt: new Date(),
    },
  })
}

async function recordPushTokenFailure(pushTokenId, reason, isInvalid = false) {
  if (!pushTokenId) {
    return null
  }

  return prisma.pushToken.update({
    where: {
      id: pushTokenId,
    },
    data: {
      lastFailureAt: new Date(),
      lastSeenAt: new Date(),
      ...(isInvalid
        ? {
            isActive: false,
            status: "INVALID",
            invalidReason: String(reason || "provider_invalid_token"),
          }
        : {}),
    },
  })
}

async function getActivePushTokensForUser(userId) {
  return prisma.pushToken.findMany({
    where: {
      userId,
      isActive: true,
      status: "ACTIVE",
    },
    orderBy: [
      {
        lastSeenAt: "desc",
      },
      {
        createdAt: "desc",
      },
    ],
  })
}

async function cleanupStalePushTokens(staleDays = 45) {
  const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000)

  return prisma.pushToken.updateMany({
    where: {
      status: "ACTIVE",
      isActive: true,
      lastSeenAt: {
        lt: cutoff,
      },
    },
    data: {
      status: "STALE",
      isActive: false,
      invalidReason: "stale_device_registration",
    },
  })
}

export {
  cleanupStalePushTokens,
  deactivatePushToken,
  getActivePushTokensForUser,
  invalidatePushToken,
  markPushTokenDelivered,
  normalizeDeviceRegistration,
  recordPushTokenFailure,
  savePushToken,
}
