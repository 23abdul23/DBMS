import { getPrismaClient } from "../../config/prisma.js"
import { eventBus } from "../events/eventBus.js"
import notificationTypes from "../constants/notificationTypes.js"
import notificationPriority from "../constants/notificationPriority.js"

const prisma = getPrismaClient()

/**
 * Test hello notification controller
 * Handles sending HELLO test notifications via super_admin
 */

/**
 * Normalizes student identifier (email or ID)
 * @param {string} identifier - Student email or ID
 * @returns {string} Normalized identifier
 */
function normalizeIdentifier(identifier) {
  return String(identifier || "")
    .trim()
    .toLowerCase()
}

/**
 * Finds student by email or ID
 * @param {string} identifier - Student email (iit2024244@iiita.ac.in) or ID (iit2024244)
 * @returns {Promise<Object|null>} User object or null
 */
async function findStudentByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier)

  console.log(`[Test] Resolving student identifier: ${normalized}`)

  // Try email lookup first
  if (normalized.includes("@")) {
    const student = await prisma.user.findFirst({
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

    console.log(
      `[Test] Email lookup result: ${student ? student.id : "not found"}`,
    )

    return student
  }

  // Try ID lookup
  const student = await prisma.user.findFirst({
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

  console.log(`[Test] ID lookup result: ${student ? student.id : "not found"}`)

  return student
}

/**
 * Checks if student has active push token
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Token object or null
 */
async function getActivePushToken(userId) {
  const pushToken = await prisma.pushToken.findFirst({
    where: {
      userId,
      isActive: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      token: true,
      platform: true,
      deviceName: true,
    },
  })

  console.log(
    `[Test] Active push token lookup for ${userId}: ${pushToken ? pushToken.id : "none"}`,
  )

  return pushToken
}

/**
 * Main controller function to send HELLO test notification
 * @param {string} studentIdentifier - Email or ID of student
 * @returns {Promise<Object>} Result object with status and details
 */
export async function testHelloNotification(studentIdentifier) {
  try {
    console.log(`[Test] HELLO notification requested for: ${studentIdentifier}`)

    // Find student
    const student = await findStudentByIdentifier(studentIdentifier)

    if (!student) {
      console.warn(`[Test] Student not found: ${studentIdentifier}`)
      return {
        success: false,
        error: "Student not found",
        studentIdentifier,
      }
    }

    console.log(`[Test] Found student: ${student.id} (${student.email})`)

    // Check push token
    const pushToken = await getActivePushToken(student.id)

    if (!pushToken) {
      console.warn(`[Test] No active push token for student: ${student.id}`)
      return {
        success: false,
        error: "No active push token for this student",
        studentId: student.id,
        studentEmail: student.email,
        studentName: student.name,
        tokenFound: false,
      }
    }

    console.log(
      `[Test] Found push token: ${pushToken.token.substring(0, 50)}...`,
    )

    // Emit HELLO event to queue
    const payload = {
      userId: student.id,
      title: "🔔 HELLO Test Notification",
      message:
        "This is a test notification from super_admin. If you see this, push notifications are working!",
      type: notificationTypes.HELLO,
      priority: notificationPriority.NORMAL,
      entityId: student.id,
      entityType: "TEST",
      routeName: "Notifications",
    }

    console.log(`[Test] Emitting HELLO event for user: ${student.id}`)
    eventBus.emit("HELLO", payload)

    return {
      success: true,
      studentId: student.id,
      studentEmail: student.email,
      studentName: student.name,
      tokenFound: true,
      tokenInfo: {
        platform: pushToken.platform,
        deviceName: pushToken.deviceName || "Unknown Device",
      },
      notificationPayload: payload,
      message: `HELLO notification queued for ${student.name} (${student.email})`,
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
