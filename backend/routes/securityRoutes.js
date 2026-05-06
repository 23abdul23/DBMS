const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")
const {
  OUTPASS_REQUEST_TYPE,
  outpassInclude,
} = require("../utils/outpassLifecycle")
const {
  classifyLocation,
  isExitGate,
  requiresOutpassForExit,
} = require("../utils/locationPolicy")

const prisma = getPrismaClient()
const router = express.Router()
const ACTIVITY_MANAGED_LOCATIONS = new Set(["Library", "SAC"])

const scannedUserSelect = {
  id: true,
  name: true,
  studentId: true,
  role: true,
  gender: true,
  hostel: true,
  roomNumber: true,
}

const buildOutpassSummary = (outpass) =>
  outpass
    ? {
        id: outpass.id,
        requestType: outpass.requestType,
        type: outpass.requestType,
        status: outpass.status,
        reason: outpass.reason,
        purpose: outpass.reason,
        destination: outpass.destination,
        outDate: outpass.outDate,
        expectedReturnDate: outpass.expectedReturnDate,
        actualReturnDate: outpass.actualReturnDate,
        rejectionReason: outpass.rejectionReason || null,
      }
    : null

const LOG_RANGE_PRESETS = new Set([
  "today",
  "yesterday",
  "last_3_days",
  "last_week",
  "last_month",
  "custom_month",
])

const createHttpError = (statusCode, message) => {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

const buildMovementLogPayload = ({
  scannedUser,
  action,
  location,
  guardId,
  guardName,
  scannedByUserId,
  success = true,
  details = {},
  errorCode = null,
  errorMessage = null,
}) => ({
  id: generateId(),
  userId: scannedUser.id,
  action,
  location: location || null,
  guardId: guardId || null,
  guardName: guardName || null,
  success,
  details: {
    message: success
      ? "Security log created successfully"
      : "Security warning created",
    scannedUserId: scannedUser.id,
    scannedStudentId: scannedUser.studentId || null,
    scannedUserName: scannedUser.name,
    scannedByUserId,
    ...details,
  },
  scanType: "qr",
  errorCode,
  errorMessage,
})

const createStandardMovementLog = async (client, options) =>
  client.log.create({
    data: buildMovementLogPayload(options),
  })

const getWithoutOutpassReason = (outpass, timestamp) => {
  if (!outpass) {
    return {
      reasonCode: "no_outpass_request",
      reason: "No outpass request was found for this student.",
    }
  }

  if (outpass.status === "pending") {
    return {
      reasonCode: "pending_approval",
      reason: "Outpass request is still pending approval.",
    }
  }

  if (outpass.status === "rejected") {
    return {
      reasonCode: "rejected",
      reason: outpass.rejectionReason
        ? `Outpass request was rejected: ${outpass.rejectionReason}`
        : "Outpass request was rejected.",
    }
  }

  if (outpass.status === "cancelled") {
    return {
      reasonCode: "cancelled",
      reason: "Outpass request was cancelled.",
    }
  }

  if (outpass.status === "expired" || outpass.expectedReturnDate <= timestamp) {
    return {
      reasonCode: "expired",
      reason:
        "Approved outpass is no longer valid because the allowed time window has expired.",
    }
  }

  if (outpass.actualReturnDate) {
    return {
      reasonCode: "already_used",
      reason: "Approved outpass has already been used for a completed trip.",
    }
  }

  if (outpass.status === "approved" && outpass.outDate > timestamp) {
    return {
      reasonCode: "not_active_yet",
      reason:
        "Approved outpass exists, but its exit window has not started yet.",
    }
  }

  return {
    reasonCode: "not_approved",
    reason:
      "This student does not have an approved outpass for this exit attempt.",
  }
}

const createWithoutOutpassWarning = async ({
  scannedUser,
  location,
  guardId,
  guardName,
  scannedByUserId,
  timestamp,
}) => {
  const latestOutpass = await prisma.outpass.findFirst({
    where: {
      userId: scannedUser.id,
    },
    orderBy: [{ outDate: "desc" }, { createdAt: "desc" }],
    include: outpassInclude,
  })

  const { reasonCode, reason } = getWithoutOutpassReason(
    latestOutpass,
    timestamp,
  )
  const log = await createStandardMovementLog(prisma, {
    scannedUser,
    action: "without_outpass",
    location,
    guardId,
    guardName,
    scannedByUserId,
    success: false,
    details: {
      direction: "exit",
      attemptedAction: "exit",
      warningType: "outpass_required",
      reasonCode,
      reason,
      title: "Exit Attempted",
      outpassId: latestOutpass?.id || null,
      requestType: latestOutpass?.requestType || OUTPASS_REQUEST_TYPE.REGULAR,
    },
    errorCode: "WITHOUT_OUTPASS",
    errorMessage: reason,
  })

  return {
    log,
    outpass: latestOutpass,
  }
}

const parsePositiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getRangeWindow = ({ rangePreset, month, year }) => {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)

  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)

  switch (rangePreset) {
    case "yesterday": {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 1)
      return { start, end: todayStart, label: "Yesterday" }
    }
    case "last_3_days": {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 2)
      return { start, end: tomorrowStart, label: "Last 3 Days" }
    }
    case "last_week": {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 6)
      return { start, end: tomorrowStart, label: "Last 7 Days" }
    }
    case "last_month": {
      const start = new Date(todayStart)
      start.setDate(start.getDate() - 29)
      return { start, end: tomorrowStart, label: "Last 30 Days" }
    }
    case "custom_month": {
      const parsedMonth = Number.parseInt(month, 10)
      const parsedYear = Number.parseInt(year, 10)

      if (
        !Number.isFinite(parsedMonth) ||
        !Number.isFinite(parsedYear) ||
        parsedMonth < 1 ||
        parsedMonth > 12
      ) {
        return null
      }

      const start = new Date(parsedYear, parsedMonth - 1, 1, 0, 0, 0, 0)
      const end = new Date(parsedYear, parsedMonth, 1, 0, 0, 0, 0)
      const monthName = start.toLocaleString("en-US", { month: "long" })

      return { start, end, label: `${monthName} ${parsedYear}` }
    }
    case "today":
    default:
      return { start: todayStart, end: tomorrowStart, label: "Today" }
  }
}

const getResolvedAction = async ({ userId, action, location }) => {
  const allowedActions = new Set(["entry", "exit"])

  if (action && allowedActions.has(action)) {
    return action
  }

  const resolvedLocation = classifyLocation(location).name || null
  const baseWhere = {
    userId,
    action: {
      in: ["entry", "exit"],
    },
  }

  const logs = await prisma.log.findMany({
    where: {
      ...baseWhere,
      ...(resolvedLocation && !isExitGate(resolvedLocation)
        ? {
            location: resolvedLocation,
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: resolvedLocation && isExitGate(resolvedLocation) ? 100 : 1,
  })

  const previousLog =
    resolvedLocation && isExitGate(resolvedLocation)
      ? logs.find((log) => isExitGate(log.location))
      : logs[0]

  return previousLog?.action === "entry" ? "exit" : "entry"
}

const findScannedUser = async ({ userId, studentId }) => {
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: scannedUserSelect,
    })

    if (user) {
      return user
    }
  }

  if (studentId) {
    const user = await prisma.user.findFirst({
      where: { studentId: String(studentId) },
      select: scannedUserSelect,
    })

    if (user) {
      return user
    }
  }

  return null
}

const createMovementLog = async ({
  scannedUser,
  action,
  location,
  guardId,
  guardName,
  scannedByUserId,
}) => {
  const locationInfo = classifyLocation(location)
  const resolvedLocation = locationInfo.name || null

  if (resolvedLocation && ACTIVITY_MANAGED_LOCATIONS.has(resolvedLocation)) {
    throw createHttpError(
      400,
      `${resolvedLocation} uses its own activity flow. Do not create entry or exit logs there.`,
    )
  }

  const resolvedAction = await getResolvedAction({
    userId: scannedUser.id,
    action,
    location: resolvedLocation,
  })
  const timestamp = new Date()

  if (
    scannedUser.role !== "student" ||
    !["entry", "exit"].includes(resolvedAction)
  ) {
    const log = await createStandardMovementLog(prisma, {
      scannedUser,
      action: resolvedAction,
      location: resolvedLocation,
      guardId,
      guardName,
      scannedByUserId,
    })

    return {
      log,
      outpass: null,
    }
  }

  if (resolvedAction === "exit") {
    if (isExitGate(resolvedLocation)) {
      const candidateOutpass = await prisma.outpass.findFirst({
        where: {
          userId: scannedUser.id,
          status: "approved",
          actualReturnDate: null,
          outDate: {
            lte: timestamp,
          },
          expectedReturnDate: {
            gt: timestamp,
          },
        },
        orderBy: [{ outDate: "desc" }, { createdAt: "desc" }],
        include: outpassInclude,
      })

      if (candidateOutpass) {
        const latestMovement = await prisma.log.findFirst({
          where: {
            userId: scannedUser.id,
            action: {
              in: ["entry", "exit"],
            },
          },
          orderBy: { createdAt: "desc" },
        })

        if (
          latestMovement?.action === "exit" &&
          latestMovement.createdAt >= candidateOutpass.outDate
        ) {
          throw createHttpError(
            400,
            "This outpass has already been used for exit",
          )
        }

        return prisma.$transaction(async (tx) => {
          const log = await createStandardMovementLog(tx, {
            scannedUser,
            action: resolvedAction,
            location: resolvedLocation,
            guardId,
            guardName,
            scannedByUserId,
            details: {
              outpassId: candidateOutpass.id,
              requestType: candidateOutpass.requestType,
            },
          })

          await tx.outpassAuditTrail.create({
            data: {
              id: generateId(),
              outpassId: candidateOutpass.id,
              status: candidateOutpass.status,
              changedBy: scannedByUserId,
              changedAt: timestamp,
              remarks: "Student exited campus using approved outpass",
            },
          })

          await tx.log.create({
            data: {
              id: generateId(),
              userId: scannedUser.id,
              action: "outpass_used",
              location: resolvedLocation,
              guardId: guardId || null,
              guardName: guardName || null,
              success: true,
              details: {
                direction: "exit",
                outpassId: candidateOutpass.id,
                requestType: candidateOutpass.requestType,
                scannedByUserId,
              },
              scanType: "qr",
            },
          })

          return {
            log,
            outpass: candidateOutpass,
          }
        })
      }

      if (requiresOutpassForExit(resolvedLocation, timestamp)) {
        if (scannedUser.gender === "female") {
          return createWithoutOutpassWarning({
            scannedUser,
            location: resolvedLocation,
            guardId,
            guardName,
            scannedByUserId,
            timestamp,
          })
        }

        throw createHttpError(
          400,
          "An approved outpass is required to exit campus after 6:00 PM",
        )
      }
    }

    const log = await createStandardMovementLog(prisma, {
      scannedUser,
      action: resolvedAction,
      location: resolvedLocation,
      guardId,
      guardName,
      scannedByUserId,
    })

    return {
      log,
      outpass: null,
    }
  }

  if (!isExitGate(resolvedLocation)) {
    const log = await createStandardMovementLog(prisma, {
      scannedUser,
      action: resolvedAction,
      location: resolvedLocation,
      guardId,
      guardName,
      scannedByUserId,
    })

    return {
      log,
      outpass: null,
    }
  }

  const candidateOutpass = await prisma.outpass.findFirst({
    where: {
      userId: scannedUser.id,
      status: {
        in: ["approved", "expired"],
      },
      actualReturnDate: null,
      outDate: {
        lte: timestamp,
      },
    },
    orderBy: [{ outDate: "desc" }, { createdAt: "desc" }],
    include: outpassInclude,
  })

  return prisma.$transaction(async (tx) => {
    const log = await createStandardMovementLog(tx, {
      scannedUser,
      action: resolvedAction,
      location: resolvedLocation,
      guardId,
      guardName,
      scannedByUserId,
      details: {
        outpassId: candidateOutpass?.id || null,
        requestType: candidateOutpass?.requestType || null,
      },
    })

    let updatedOutpass = null

    if (candidateOutpass) {
      await tx.outpass.update({
        where: {
          id: candidateOutpass.id,
        },
        data: {
          actualReturnDate: timestamp,
        },
      })

      await tx.outpassAuditTrail.create({
        data: {
          id: generateId(),
          outpassId: candidateOutpass.id,
          status: candidateOutpass.status,
          changedBy: scannedByUserId,
          changedAt: timestamp,
          remarks:
            candidateOutpass.status === "expired"
              ? "Student returned to campus after the outpass window had expired"
              : "Student returned to campus using outpass",
        },
      })

      await tx.log.create({
        data: {
          id: generateId(),
          userId: scannedUser.id,
          action: "outpass_used",
          location: resolvedLocation,
          guardId: guardId || null,
          guardName: guardName || null,
          success: true,
          details: {
            direction: "entry",
            outpassId: candidateOutpass.id,
            requestType: candidateOutpass.requestType,
            scannedByUserId,
          },
          scanType: "qr",
        },
      })

      updatedOutpass = await tx.outpass.findUnique({
        where: {
          id: candidateOutpass.id,
        },
        include: outpassInclude,
      })
    }

    return {
      log,
      outpass: updatedOutpass,
    }
  })
}

router.post("/log", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "security") {
      return res.status(403).json({
        message: "Only security staff can scan student QR codes.",
      })
    }

    const { action, location, guardId, guardName, userId, studentId } = req.body
    const scannedUser = await findScannedUser({ userId, studentId })

    if (!scannedUser) {
      return res.status(400).json({
        message: "Invalid QR data. Unable to identify scanned student.",
      })
    }

    const { log, outpass } = await createMovementLog({
      scannedUser,
      action,
      location,
      guardId: req.user.guardId || guardId || null,
      guardName: req.user.name || guardName || null,
      scannedByUserId: req.user.userId,
    })

    res.status(200).json({
      message:
        log.action === "without_outpass"
          ? "Exit attempt recorded without approved outpass"
          : "Security log created successfully",
      log,
      user: scannedUser,
      outpass: buildOutpassSummary(outpass),
    })
  } catch (error) {
    console.error("Security log error:", error)
    res
      .status(error.statusCode || 500)
      .json({ message: error.message || "Server error creating security log" })
  }
})

router.post("/student-log", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({
        message: "Only students can log movement from a guard location QR.",
      })
    }

    const { action, location, guardId, guardName } = req.body
    const normalizedLocation =
      typeof location === "string" ? location.trim() : ""
    const normalizedGuardId = typeof guardId === "string" ? guardId.trim() : ""
    const normalizedGuardName =
      typeof guardName === "string" ? guardName.trim() : ""

    if (!normalizedLocation && !normalizedGuardId && !normalizedGuardName) {
      return res.status(400).json({
        message: "Invalid guard QR data. Missing location or guard details.",
      })
    }

    let matchedGuard = null

    if (normalizedGuardId) {
      matchedGuard = await prisma.user.findFirst({
        where: {
          guardId: normalizedGuardId,
          role: "security",
        },
        select: {
          id: true,
          name: true,
          guardId: true,
        },
      })

      if (!matchedGuard) {
        return res.status(400).json({
          message: "Invalid guard QR data. Guard not found.",
        })
      }
    }

    const scannedUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: scannedUserSelect,
    })

    if (!scannedUser) {
      return res.status(404).json({ message: "Student not found." })
    }

    const { log, outpass } = await createMovementLog({
      scannedUser,
      action,
      location: normalizedLocation || null,
      guardId: matchedGuard?.guardId || normalizedGuardId || null,
      guardName: matchedGuard?.name || normalizedGuardName || null,
      scannedByUserId: req.user.userId,
    })

    res.status(200).json({
      message:
        log.action === "without_outpass"
          ? "Exit attempt recorded without approved outpass"
          : "Student movement logged successfully",
      log,
      user: scannedUser,
      outpass: buildOutpassSummary(outpass),
    })
  } catch (error) {
    console.error("Student movement log error:", error)
    res.status(error.statusCode || 500).json({
      message: error.message || "Server error creating student movement log",
    })
  }
})

router.get("/logs", authenticate, async (req, res) => {
  try {
    if (req.user.role !== "security") {
      return res
        .status(403)
        .json({ message: "Only security staff can view security logs." })
    }

    const location =
      typeof req.query.location === "string" ? req.query.location.trim() : ""
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : ""
    const rangePreset =
      typeof req.query.rangePreset === "string" &&
      LOG_RANGE_PRESETS.has(req.query.rangePreset)
        ? req.query.rangePreset
        : "today"
    const page = parsePositiveInteger(req.query.page, 1)
    const limit = Math.min(parsePositiveInteger(req.query.limit, 20), 100)
    const month =
      typeof req.query.month === "string" ? req.query.month : undefined
    const year = typeof req.query.year === "string" ? req.query.year : undefined
    const skip = (page - 1) * limit

    const rangeWindow = getRangeWindow({ rangePreset, month, year })
    if (!rangeWindow) {
      return res
        .status(400)
        .json({ message: "Invalid month or year for custom month filter" })
    }

    const where = {
      createdAt: {
        gte: rangeWindow.start,
        lt: rangeWindow.end,
      },
      ...(location
        ? {
            location: {
              contains: location,
              mode: "insensitive",
            },
          }
        : {}),
      ...(search
        ? {
            user: {
              is: {
                OR: [
                  {
                    name: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                  {
                    studentId: {
                      contains: search,
                      mode: "insensitive",
                    },
                  },
                ],
              },
            },
          }
        : {}),
    }

    const [logs, total] = await prisma.$transaction([
      prisma.log.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              studentId: true,
              role: true,
              hostel: true,
              roomNumber: true,
            },
          },
        },
      }),
      prisma.log.count({ where }),
    ])

    res.status(200).json({
      logs,
      page,
      limit,
      total,
      hasMore: skip + logs.length < total,
      activeRangeLabel: rangeWindow.label,
    })
  } catch (error) {
    console.error("Fetch security logs error:", error)
    res.status(500).json({ message: "Server error fetching security logs" })
  }
})

module.exports = router
