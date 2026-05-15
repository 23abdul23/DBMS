import Expo from "expo-server-sdk"

const expo = new Expo()

async function sendPushNotification({ token, title, body, data = {} }) {
  if (!token) {
    console.warn("[Push] Token is missing")
    return
  }

  if (!Expo.isExpoPushToken(token)) {
    console.warn(`[Push] Invalid Expo push token: ${token}`)
    return
  }

  try {
    const messages = [
      {
        to: token,
        sound: "default",
        title,
        body,
        data,
      },
    ]

    const response = await expo.sendPushNotificationsAsync(messages)
    console.log(`[Push] Notification sent successfully to ${token}`)
    return response
  } catch (error) {
    console.error(
      `[Push] Error sending notification to ${token}:`,
      error.message,
    )
    throw error
  }
}

export { sendPushNotification }
