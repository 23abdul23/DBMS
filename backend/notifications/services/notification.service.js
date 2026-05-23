import { getPrismaClient } from "../../config/prisma.js"

import { notificationQueue } from "../queues/notification.queue.js"
import { PushDispatchError, sendPushNotification } from "./push.service.js"
import {
  getActivePushTokensForUser,
  invalidatePushToken,
  markPushTokenDelivered,
  recordPushTokenFailure,
} from "./token.service.js"

const prisma = getPrismaClient()

function getBackoffDelay(job) {
  const configuredDelay = Number(job?.opts?.backoff?.delay || 5000)
  const attemptsMade = Number(job?.attemptsMade || 0)
  return configuredDelay * Math.max(1, 2 ** attemptsMade)
}

function toJsonSafe(value) {
  if (value === undefined || value === null) {
    return null
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      code: value.code || null,
    }
  }

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (_error) {
    return {
      value: String(value),
    }
  }
}

async function createNotification({
  userId,
  title,
  message,
  type,
  priority,
  entityId,
  entityType,
  routeName,
  params,
}) {
  const routeParams = params && typeof params === "object" ? params : null

  try {
    console.log("[Notification] Creating notification record", {
      userId,
      title,
      type,
      priority,
      entityId,
      entityType,
      routeName,
    })

    const notification = await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        priority,
        entityId,
        entityType,
        routeName: routeName || null,
        routeParams,
      },
    })

    const [badgeCount, tokens] = await Promise.all([
      prisma.notification.count({
        where: {
          userId,
          isRead: false,
        },
      }),
      getActivePushTokensForUser(userId),
    ])

    await prisma.notification.update({
      where: {
        id: notification.id,
      },
      data: {
        badgeCount,
      },
    })

    console.log(
      `[Notification] Created notification ${notification.id} for user ${userId}. badgeCount=${badgeCount}`,
    )

    if (tokens.length === 0) {
      console.warn(
        `[Notification] No active native push tokens found for user ${userId}`,
      )
      return {
        notificationId: notification.id,
        queuedDeliveries: 0,
      }
    }

    const deliveries = await Promise.all(
      tokens.map((pushToken) =>
        prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            pushTokenId: pushToken.id,
            status: "QUEUED",
          },
        }),
      ),
    )

    await notificationQueue.addBulk(
      deliveries.map((delivery) => ({
        name: "send-push-delivery",
        data: {
          deliveryId: delivery.id,
        },
        opts: {
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      })),
    )

    console.log(
      `[Notification] Queued ${deliveries.length} delivery job(s) for notification ${notification.id}`,
    )

    return {
      notificationId: notification.id,
      queuedDeliveries: deliveries.length,
    }
  } catch (error) {
    console.error(
      `[Notification] Error creating notification for user ${userId}:`,
      error,
    )
    throw error
  }
}

async function processNotificationDelivery(job) {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: {
      id: job.data.deliveryId,
    },
    include: {
      notification: true,
      pushToken: true,
    },
  })

  if (!delivery) {
    console.warn(
      `[Delivery] Delivery ${job.data.deliveryId} no longer exists. Skipping.`,
    )
    return {
      status: "SKIPPED",
    }
  }

  if (
    !delivery.pushToken?.isActive ||
    delivery.pushToken?.status !== "ACTIVE"
  ) {
    await prisma.notificationDelivery.update({
      where: {
        id: delivery.id,
      },
      data: {
        status: "SKIPPED",
        failureReason: "push_token_inactive",
      },
    })

    return {
      status: "SKIPPED",
    }
  }

  const attemptCount = Number(job.attemptsMade || 0) + 1
  const maxAttempts = Number(job.opts?.attempts || 1)

  await prisma.notificationDelivery.update({
    where: {
      id: delivery.id,
    },
    data: {
      status: "SENDING",
      attemptCount,
      failureCode: null,
      failureReason: null,
      providerResponse: null,
      nextRetryAt: null,
      sentAt: new Date(),
    },
  })

  try {
    const result = await sendPushNotification({
      pushToken: delivery.pushToken,
      title: delivery.notification.title,
      body: delivery.notification.message,
      badgeCount: delivery.notification.badgeCount,
      data: {
        notificationId: delivery.notification.id,
        entityId: delivery.notification.entityId,
        entityType: delivery.notification.entityType,
        routeName: delivery.notification.routeName,
        params: delivery.notification.routeParams,
        badgeCount: delivery.notification.badgeCount,
      },
    })

    await Promise.all([
      prisma.notificationDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          status: "DELIVERED",
          attemptCount,
          providerMessageId: result.messageId || null,
          providerResponse: toJsonSafe(result.response),
          deliveredAt: new Date(),
          nextRetryAt: null,
        },
      }),
      markPushTokenDelivered(delivery.pushToken.id),
    ])

    console.log(
      `[Delivery] Delivered notification ${delivery.notificationId} via ${result.provider} to token ${delivery.pushToken.id} on attempt ${attemptCount}`,
    )

    return {
      status: "DELIVERED",
      provider: result.provider,
      messageId: result.messageId,
    }
  } catch (error) {
    const pushError =
      error instanceof PushDispatchError
        ? error
        : new PushDispatchError(error?.message || "Push delivery failed", {
            provider: delivery.pushToken.tokenType,
            code: "UNKNOWN_PUSH_ERROR",
            details: error,
          })

    const updateData = {
      attemptCount,
      failureCode: pushError.code || "UNKNOWN_PUSH_ERROR",
      failureReason: pushError.message,
      providerResponse: toJsonSafe(pushError.details),
    }

    if (pushError.invalidToken) {
      await Promise.all([
        prisma.notificationDelivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            ...updateData,
            status: "INVALID_TOKEN",
            nextRetryAt: null,
          },
        }),
        invalidatePushToken(
          delivery.pushToken.id,
          pushError.code || pushError.message,
        ),
      ])

      console.warn(
        `[Delivery] Invalidated push token ${delivery.pushToken.id} after provider error ${pushError.code}`,
      )

      return {
        status: "INVALID_TOKEN",
        code: pushError.code,
      }
    }

    if (pushError.retryable && attemptCount < maxAttempts) {
      await Promise.all([
        prisma.notificationDelivery.update({
          where: {
            id: delivery.id,
          },
          data: {
            ...updateData,
            status: "RETRYING",
            nextRetryAt: new Date(Date.now() + getBackoffDelay(job)),
          },
        }),
        recordPushTokenFailure(delivery.pushToken.id, pushError.code),
      ])

      console.warn(
        `[Delivery] Retrying delivery ${delivery.id} after ${pushError.code} (attempt ${attemptCount}/${maxAttempts})`,
      )

      throw pushError
    }

    await Promise.all([
      prisma.notificationDelivery.update({
        where: {
          id: delivery.id,
        },
        data: {
          ...updateData,
          status: "FAILED",
          nextRetryAt: null,
        },
      }),
      recordPushTokenFailure(delivery.pushToken.id, pushError.code),
    ])

    console.error(
      `[Delivery] Permanent failure for delivery ${delivery.id}: ${pushError.code} ${pushError.message}`,
    )

    return {
      status: "FAILED",
      code: pushError.code,
    }
  }
}

export { createNotification, processNotificationDelivery }
