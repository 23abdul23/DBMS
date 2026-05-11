import { getPrismaClient } from "../../config/prisma"

import { sendPushNotification } from "../services/push.service.js"

const prisma = getPrismaClient()

async function createNotification({
  userId,
  title,
  message,
  type,
  priority,
  entityId,
  entityType,
}) {
  const notification = await prisma.notification.create({
    data: {
      userId,
      title,
      message,
      type,
      priority,
      entityId,
      entityType,
    },
  })

  const tokens = await prisma.pushToken.findMany({
    where: {
      userId,
      isActive: true,
    },
  })

  await Promise.all(
    tokens.map((token) =>
      sendPushNotification({
        token: token.token,
        title,
        body: message,
        data: {
          notificationId: notification.id,
          entityId,
          entityType,
        },
      }),
    ),
  )

  return notification
}

export { createNotification }
