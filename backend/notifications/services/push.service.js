import Expo from "expo-server-sdk"
import { deactivatePushToken } from "./token.service.js"

const expo = new Expo()

const TRANSIENT_ERROR_CODES = new Set([
  "PUSH_TOO_MANY_EXPERIENCE_IDS",
  "PUSH_TOO_MANY_NOTIFICATIONS",
  "MessageRateExceeded",
])

function shouldRetry(error) {
  const code = error?.code || error?.details?.error
  return Boolean(code && TRANSIENT_ERROR_CODES.has(code))
}

async function processReceipts(ticketIds, token) {
  if (!ticketIds.length) {
    return []
  }

  try {
    const chunks = expo.chunkPushNotificationReceiptIds(ticketIds)
    const receiptResults = []

    for (const chunk of chunks) {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk)
      for (const receiptId of Object.keys(receipts)) {
        const receipt = receipts[receiptId]
        receiptResults.push({ id: receiptId, ...receipt })

        if (
          receipt?.status === "error" &&
          receipt?.details?.error === "DeviceNotRegistered"
        ) {
          await deactivatePushToken(token)
          console.warn(
            `[Push] Deactivated token due to DeviceNotRegistered: ${token}`,
          )
        }
      }
    }

    return receiptResults
  } catch (error) {
    console.error(
      `[Push] Failed to fetch receipts for ${token}:`,
      error.message,
    )
    return []
  }
}

async function sendPushNotification({ token, title, body, data = {} }) {
  if (!token) {
    console.warn("[Push] Token is missing")
    return
  }

  if (!Expo.isExpoPushToken(token)) {
    console.warn(`[Push] Invalid Expo push token: ${token}`)
    return
  }

  const messages = [
    {
      to: token,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
      channelId: "default",
    },
  ]

  const chunks = expo.chunkPushNotifications(messages)
  let lastError = null

  for (const chunk of chunks) {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const tickets = await expo.sendPushNotificationsAsync(chunk)
        const ticketIds = tickets
          .filter((ticket) => ticket?.status === "ok" && ticket?.id)
          .map((ticket) => ticket.id)

        for (const ticket of tickets) {
          if (
            ticket?.status === "error" &&
            ticket?.details?.error === "DeviceNotRegistered"
          ) {
            await deactivatePushToken(token)
            console.warn(
              `[Push] Deactivated token due to DeviceNotRegistered: ${token}`,
            )
          }
        }

        const receipts = await processReceipts(ticketIds, token)

        console.log(`[Push] Notification sent successfully to ${token}`)
        return { tickets, receipts }
      } catch (error) {
        lastError = error
        console.error(
          `[Push] Send attempt ${attempt} failed for ${token}:`,
          error.message,
        )

        if (!shouldRetry(error) || attempt === 2) {
          break
        }
      }
    }
  }

  throw lastError || new Error("Unknown push notification error")
}

export { sendPushNotification }
