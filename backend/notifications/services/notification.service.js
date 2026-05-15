import { getPrismaClient } from "../../config/prisma.js"

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
  try {
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

    console.log(
      `[Notification] Created notification ${notification.id} for user ${userId}`,
    )

    const tokens = await prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
      },
    })

    if (tokens.length === 0) {
      console.warn(
        `[Notification] No active push tokens found for user ${userId}`,
      )
      return notification
    }

    console.log(
      `[Notification] Sending push to ${tokens.length} device(s) for user ${userId}`,
    )

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
        }).catch((error) => {
          console.error(
            `[Notification] Failed to send push to ${token.token}:`,
            error.message,
          )
        }),
      ),
    )

    return notification
  } catch (error) {
    console.error(
      `[Notification] Error creating notification for user ${userId}:`,
      error,
    )
    throw error
  }
}

export { createNotification }
