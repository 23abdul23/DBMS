import { getPrismaClient } from "../../config/prisma.js"
import { eventBus } from "../events/eventBus.js"
import notificationPriority from "../constants/notificationPriority.js"

const prisma = getPrismaClient()

function normalizeIdentifier(identifier) {
  return String(identifier || "")
    .trim()
    .toLowerCase()
}

async function findStudentByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier)

  if (normalized.includes("@")) {
    return prisma.user.findFirst({
      where: {
        email: {
          mode: "insensitive",
          equals: normalized,
        },
        role: "student",
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    })
  }

  return prisma.user.findFirst({
    where: {
      OR: [
        {
          id: normalized,
        },
        {
          email: {
            mode: "insensitive",
            startsWith: normalized,
          },
        },
      ],
      role: "student",
    },
    select: {
      id: true,
      email: true,
      name: true,
    },
  })
}

async function getActivePushTokens(userId) {
  return prisma.pushToken.findMany({
    where: {
      userId,
      isActive: true,
      status: "ACTIVE",
    },
    select: {
      id: true,
      tokenType: true,
      platform: true,
      deviceName: true,
      deviceId: true,
      appVersion: true,
      buildNumber: true,
    },
    orderBy: {
      lastSeenAt: "desc",
    },
  })
}

export async function testHelloNotification(studentIdentifier) {
  try {
    console.log(`[Test] Native push test requested for: ${studentIdentifier}`)

    const student = await findStudentByIdentifier(studentIdentifier)

    if (!student) {
      return {
        success: false,
        error: "Student not found",
        studentIdentifier,
      }
    }

    const activeTokens = await getActivePushTokens(student.id)

    if (activeTokens.length === 0) {
      return {
        success: false,
        error: "No active native push token for this student",
        studentId: student.id,
        studentEmail: student.email,
        studentName: student.name,
        tokenFound: false,
      }
    }

    const payload = {
      userId: student.id,
      title: "Native Push Test",
      message:
        "This push came through the direct FCM/APNs pipeline without Expo relay.",
      type: "SYSTEM",
      priority: notificationPriority.NORMAL,
      entityId: student.id,
      entityType: "TEST",
      routeName: "Notifications",
      params: {
        tab: "notifications",
      },
    }

    eventBus.emit("HELLO", payload)

    return {
      success: true,
      studentId: student.id,
      studentEmail: student.email,
      studentName: student.name,
      tokenFound: true,
      tokenCount: activeTokens.length,
      tokenInfo: activeTokens.map((token) => ({
        id: token.id,
        tokenType: token.tokenType,
        platform: token.platform,
        deviceId: token.deviceId,
        deviceName: token.deviceName || "Unknown device",
        appVersion: token.appVersion,
        buildNumber: token.buildNumber,
      })),
      notificationPayload: payload,
      message: `Native push notification queued for ${student.name} (${student.email})`,
    }
  } catch (error) {
    console.error("[Test] Error in testHelloNotification:", error)
    return {
      success: false,
      error: error.message,
    }
  }
}

export default {
  testHelloNotification,
}
