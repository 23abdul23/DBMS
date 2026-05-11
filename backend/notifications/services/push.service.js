import Expo from "expo-server-sdk"

const expo = new Expo()

async function sendPushNotification({ token, title, body, data = {} }) {
  if (!Expo.isExpoPushToken(token)) {
    return
  }

  const messages = [
    {
      to: token,
      sound: "default",
      title,
      body,
      data,
    },
  ]

  await expo.sendPushNotificationsAsync(messages)
}

export { sendPushNotification }
