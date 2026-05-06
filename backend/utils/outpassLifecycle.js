import { generateId } from "./hashGenerator.js"
import { isExitGate } from "./locationPolicy.js"

export const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  studentId: true,
  hostel: true,
  roomNumber: true,
  phoneNumber: true,
  emergencyContact: true,
  department: true,
  year: true,
}

export const approverSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  hostel: true,
}

export const auditUserSelect = {
  id: true,
  name: true,
  role: true,
}

export const OUTPASS_REQUEST_TYPE = {
  REGULAR: "regular",
  LONG_VISIT: "long_visit",
}

export const CAMPUS_RISK_LEVEL = {
  NORMAL: "normal",
  YELLOW: "yellow",
  DANGER: "danger",
}

export const MAX_ADVANCE_DAYS = 1
export const RETURN_CUTOFF_HOUR = 22
export const RETURN_CUTOFF_MINUTE = 30
export const YELLOW_ALERT_HOUR = 21
export const YELLOW_ALERT_MINUTE = 30

export const outpassInclude = {
  user: {
    select: userSelect,
  },
  approvedBy: {
    select: approverSelect,
  },
  auditTrail: {
    orderBy: {
      changedAt: "asc",
    },
    include: {
      user: {
        select: auditUserSelect,
      },
    },
  },
}

export const getStartOfDay = (value = new Date()) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

export const addDays = (value, days) => {
  const date = new Date(value)
  date.setDate(date.getDate() + days)
  return date
}

export const getDayRange = (value = new Date()) => {
  const start = getStartOfDay(value)
  const end = addDays(start, 1)
  return { start, end }
}

export const getCutoffTimeForDate = (value, hours, minutes) => {
  const date = new Date(value)
  date.setHours(hours, minutes, 0, 0)
  return date
}

export const toDate = (value) => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export const combineDateAndTime = (dateValue, timeValue) => {
  const datePart = toDate(dateValue)
  const timePart = toDate(timeValue)

  if (!datePart || !timePart) {
    return null
  }

  const combined = new Date(datePart)
  combined.setHours(
    timePart.getHours(),
    timePart.getMinutes(),
    timePart.getSeconds(),
    timePart.getMilliseconds(),
  )

  return combined
}

export const resolveOutpassDateTimes = (payload = {}) => {
  const exitDate =
    combineDateAndTime(payload.fromDate, payload.fromTime) ||
    combineDateAndTime(payload.outDate, payload.fromTime) ||
    toDate(payload.fromTime) ||
    toDate(payload.exitTime) ||
    toDate(payload.outDate)

  const returnDate =
    combineDateAndTime(payload.toDate, payload.toTime) ||
    combineDateAndTime(payload.expectedReturnDate, payload.toTime) ||
    toDate(payload.toTime) ||
    toDate(payload.expectedReturnTime) ||
    toDate(payload.expectedReturnDate)

  return {
    exitDate,
    returnDate,
  }
}

export const normalizeOutpassRequestType = (value) =>
  String(value || "")
    .trim()
    .toLowerCase() === OUTPASS_REQUEST_TYPE.LONG_VISIT
    ? OUTPASS_REQUEST_TYPE.LONG_VISIT
    : OUTPASS_REQUEST_TYPE.REGULAR

export const resolveOutpassRequestType = (payload = {}) => {
  if (
    payload.longVisit === true ||
    String(payload.longVisit || "")
      .trim()
      .toLowerCase() === "true"
  ) {
    return OUTPASS_REQUEST_TYPE.LONG_VISIT
  }

  return normalizeOutpassRequestType(payload.requestType || payload.type)
}

export const isLongVisitOutpass = (outpass) =>
  normalizeOutpassRequestType(outpass?.requestType || outpass?.type) ===
  OUTPASS_REQUEST_TYPE.LONG_VISIT

export const isSameCalendarDay = (left, right) => {
  if (!left || !right) {
    return false
  }

  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

export const isWithinAdvanceWindow = (exitDate, now = new Date()) => {
  const startOfToday = getStartOfDay(now)
  const endOfTomorrow = addDays(startOfToday, MAX_ADVANCE_DAYS + 1)
  return exitDate >= startOfToday && exitDate < endOfTomorrow
}

export const hasExitedForOutpass = (outpass, latestMovement) =>
  latestMovement?.action === "exit" &&
  latestMovement?.createdAt >= outpass.outDate

export const getCampusRiskLevel = (
  outpass,
  latestMovement,
  now = new Date(),
) => {
  if (
    !outpass ||
    isLongVisitOutpass(outpass) ||
    outpass.actualReturnDate ||
    !hasExitedForOutpass(outpass, latestMovement)
  ) {
    return CAMPUS_RISK_LEVEL.NORMAL
  }

  const yellowThreshold = getCutoffTimeForDate(
    outpass.outDate,
    YELLOW_ALERT_HOUR,
    YELLOW_ALERT_MINUTE,
  )
  const dangerThreshold = getCutoffTimeForDate(
    outpass.outDate,
    RETURN_CUTOFF_HOUR,
    RETURN_CUTOFF_MINUTE,
  )

  if (now >= dangerThreshold) {
    return CAMPUS_RISK_LEVEL.DANGER
  }

  if (now >= yellowThreshold) {
    return CAMPUS_RISK_LEVEL.YELLOW
  }

  return CAMPUS_RISK_LEVEL.NORMAL
}

export const canUseOutpass = (outpass, latestMovement, now = new Date()) => {
  if (!outpass) {
    return false
  }

  if (outpass.status !== "approved" || outpass.actualReturnDate) {
    return false
  }

  if (hasExitedForOutpass(outpass, latestMovement)) {
    return false
  }

  return outpass.outDate <= now && outpass.expectedReturnDate > now
}

export const canCancelOutpass = (outpass, latestMovement, now = new Date()) => {
  if (!outpass) {
    return false
  }

  if (!["pending", "approved"].includes(outpass.status)) {
    return false
  }

  if (
    outpass.actualReturnDate ||
    hasExitedForOutpass(outpass, latestMovement)
  ) {
    return false
  }

  return outpass.expectedReturnDate > now
}

export const validateOutpassWindow = ({
  exitDate,
  returnDate,
  requestType,
  now = new Date(),
}) => {
  if (!exitDate || !returnDate) {
    return "Please provide purpose, destination, departure, and return time"
  }

  if (returnDate <= exitDate) {
    return "Expected return time must be after departure time"
  }

  const normalizedType = normalizeOutpassRequestType(requestType)

  if (!isWithinAdvanceWindow(exitDate, now)) {
    return "Outpasses can only be requested for today or tomorrow"
  }

  if (normalizedType === OUTPASS_REQUEST_TYPE.LONG_VISIT) {
    return null
  }

  const pastThreshold = new Date(now.getTime() - 5 * 60 * 1000)
  if (exitDate < pastThreshold) {
    return "Departure time cannot be more than 5 minutes in the past"
  }

  if (!isSameCalendarDay(exitDate, returnDate)) {
    return "Regular outpasses must start and end on the same day"
  }

  const returnCutoff = getCutoffTimeForDate(
    exitDate,
    RETURN_CUTOFF_HOUR,
    RETURN_CUTOFF_MINUTE,
  )
  if (returnDate > returnCutoff) {
    return "Regular outpasses must end by 10:30 PM"
  }

  return null
}

const serializeAuditItem = (auditItem) => ({
  id: auditItem.id,
  status: auditItem.status,
  remarks: auditItem.remarks,
  changedAt: auditItem.changedAt,
  changedBy: auditItem.changedBy,
  user: auditItem.user
    ? {
        id: auditItem.user.id,
        name: auditItem.user.name,
        role: auditItem.user.role,
      }
    : null,
})

const buildEmergencyContact = (outpass) => {
  if (!outpass.emergencyContactName && !outpass.emergencyContactPhone) {
    return null
  }

  return {
    name: outpass.emergencyContactName || null,
    phone: outpass.emergencyContactPhone || null,
  }
}

export const deriveMonitoringState = (
  outpass,
  latestMovement,
  now = new Date(),
) => {
  if (outpass.actualReturnDate) {
    return outpass.status === "expired" ? "returned_late" : "returned"
  }

  if (outpass.status === "pending") {
    return "pending_review"
  }

  if (outpass.status === "rejected") {
    return "rejected"
  }

  if (outpass.status === "cancelled") {
    return "cancelled"
  }

  const exited = hasExitedForOutpass(outpass, latestMovement)

  if (isLongVisitOutpass(outpass)) {
    if (exited) {
      return "long_visit_away"
    }

    if (outpass.status === "approved" && outpass.outDate > now) {
      return "approved"
    }

    if (outpass.status === "approved") {
      return "awaiting_exit"
    }

    return outpass.status
  }

  if (outpass.status === "expired") {
    return exited ? "overdue" : "expired"
  }

  if (outpass.status === "approved") {
    if (exited) {
      const campusRiskLevel = getCampusRiskLevel(outpass, latestMovement, now)

      if (campusRiskLevel === CAMPUS_RISK_LEVEL.DANGER) {
        return "danger"
      }

      if (campusRiskLevel === CAMPUS_RISK_LEVEL.YELLOW) {
        return "yellow_alert"
      }

      if (outpass.expectedReturnDate <= now) {
        return "overdue"
      }

      return "ongoing"
    }

    if (outpass.outDate > now) {
      return "approved"
    }

    return "awaiting_exit"
  }

  return outpass.status
}

export const buildOutpassResponse = (outpass, options = {}) => {
  const latestMovement = options.latestMovement || null
  const now = options.now || new Date()
  const auditTrail = Array.isArray(outpass.auditTrail)
    ? outpass.auditTrail.map(serializeAuditItem)
    : []
  const requestAudit =
    auditTrail.find((item) => item.status === "pending") || null
  const latestAudit =
    auditTrail.length > 0 ? auditTrail[auditTrail.length - 1] : null
  const monitoringState = deriveMonitoringState(outpass, latestMovement, now)
  const timeRemainingMs = outpass.actualReturnDate
    ? 0
    : Math.max(
        0,
        new Date(outpass.expectedReturnDate).getTime() - now.getTime(),
      )
  const requestType = normalizeOutpassRequestType(
    outpass.requestType || outpass.type,
  )
  const campusRiskLevel = getCampusRiskLevel(outpass, latestMovement, now)
  const canCancel = canCancelOutpass(outpass, latestMovement, now)
  const canUse = canUseOutpass(outpass, latestMovement, now)

  return {
    id: outpass.id,
    _id: outpass.id,
    userId: outpass.userId,
    reason: outpass.reason,
    purpose: outpass.reason,
    destination: outpass.destination,
    outDate: outpass.outDate,
    expectedReturnDate: outpass.expectedReturnDate,
    actualReturnDate: outpass.actualReturnDate,
    requestType,
    type: requestType,
    isLongVisit: requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT,
    status: outpass.status,
    rejectionReason: outpass.rejectionReason,
    emergencyContactName: outpass.emergencyContactName,
    emergencyContactPhone: outpass.emergencyContactPhone,
    emergencyContact: buildEmergencyContact(outpass),
    approvedById: outpass.approvedById,
    remarks: requestAudit?.remarks || null,
    latestStatusRemark: latestAudit?.remarks || null,
    monitoringState,
    campusRiskLevel,
    canCancel,
    canUseOutpass: canUse,
    mustReturnBy: outpass.expectedReturnDate,
    timeRemainingMs,
    isOverdue: monitoringState === "overdue",
    createdAt: outpass.createdAt,
    updatedAt: outpass.updatedAt,
    user: outpass.user
      ? {
          id: outpass.user.id,
          _id: outpass.user.id,
          userId: outpass.user.id,
          name: outpass.user.name,
          email: outpass.user.email,
          studentId: outpass.user.studentId,
          hostel: outpass.user.hostel,
          roomNumber: outpass.user.roomNumber,
          phoneNumber: outpass.user.phoneNumber,
          emergencyContact: outpass.user.emergencyContact,
          department: outpass.user.department,
          year: outpass.user.year,
        }
      : null,
    approvedBy: outpass.approvedBy
      ? {
          id: outpass.approvedBy.id,
          name: outpass.approvedBy.name,
          email: outpass.approvedBy.email,
          role: outpass.approvedBy.role,
          hostel: outpass.approvedBy.hostel,
        }
      : null,
    latestMovement: latestMovement
      ? {
          id: latestMovement.id,
          action: latestMovement.action,
          location: latestMovement.location,
          guardId: latestMovement.guardId,
          guardName: latestMovement.guardName,
          createdAt: latestMovement.createdAt,
        }
      : null,
    auditTrail,
  }
}

export const getLatestMovementMap = async (prisma, userIds = []) => {
  const distinctUserIds = [...new Set(userIds.filter(Boolean))]

  if (distinctUserIds.length === 0) {
    return new Map()
  }

  const logs = await prisma.log.findMany({
    where: {
      userId: {
        in: distinctUserIds,
      },
      action: {
        in: ["entry", "exit"],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  const movementMap = new Map()

  for (const log of logs) {
    if (!movementMap.has(log.userId)) {
      movementMap.set(log.userId, log)
    }
  }

  return movementMap
}

export const getLatestGateMovementMap = async (prisma, userIds = []) => {
  const distinctUserIds = [...new Set(userIds.filter(Boolean))]

  if (distinctUserIds.length === 0) {
    return new Map()
  }

  const logs = await prisma.log.findMany({
    where: {
      userId: {
        in: distinctUserIds,
      },
      action: {
        in: ["entry", "exit"],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  const movementMap = new Map()

  for (const log of logs) {
    if (!isExitGate(log.location)) {
      continue
    }

    if (!movementMap.has(log.userId)) {
      movementMap.set(log.userId, log)
    }
  }

  return movementMap
}

export const getRecentMovementTrailMap = async (
  prisma,
  userIds = [],
  limitPerUser = 3,
) => {
  const distinctUserIds = [...new Set(userIds.filter(Boolean))]

  if (distinctUserIds.length === 0) {
    return new Map()
  }

  const logs = await prisma.log.findMany({
    where: {
      userId: {
        in: distinctUserIds,
      },
      action: {
        in: ["entry", "exit"],
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  const movementMap = new Map()

  for (const log of logs) {
    const existing = movementMap.get(log.userId) || []
    if (existing.length >= limitPerUser) {
      continue
    }

    existing.push(log)
    movementMap.set(log.userId, existing)
  }

  return movementMap
}

export const expireOldOutpasses = async (prisma) => {
  const now = new Date()

  const expiredCandidates = await prisma.outpass.findMany({
    where: {
      status: {
        in: ["pending", "approved"],
      },
      actualReturnDate: null,
      expectedReturnDate: {
        lt: now,
      },
    },
    select: {
      id: true,
      userId: true,
      requestType: true,
      status: true,
    },
  })

  if (expiredCandidates.length === 0) {
    return 0
  }

  const outpassIds = expiredCandidates.map((item) => item.id)

  await prisma.$transaction([
    prisma.outpass.updateMany({
      where: {
        id: {
          in: outpassIds,
        },
      },
      data: {
        status: "expired",
      },
    }),
    prisma.outpassAuditTrail.createMany({
      data: expiredCandidates.map((item) => ({
        id: generateId(),
        outpassId: item.id,
        status: "expired",
        changedBy: null,
        changedAt: now,
        remarks:
          item.status === "pending"
            ? "Request auto-expired before the approval window ended"
            : "Outpass auto-expired after the expected return time elapsed",
      })),
    }),
    prisma.log.createMany({
      data: expiredCandidates.map((item) => ({
        id: generateId(),
        userId: item.userId,
        action: "outpass_status_changed",
        success: true,
        details: {
          outpassId: item.id,
          requestType: item.requestType,
          previousStatus: item.status,
          nextStatus: "expired",
          source: "auto_expiry",
        },
        scanType: "manual",
      })),
    }),
  ])

  return outpassIds.length
}
