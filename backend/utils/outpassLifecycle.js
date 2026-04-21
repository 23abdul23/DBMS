const { generateId } = require("./hashGenerator")

const userSelect = {
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

const approverSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  hostel: true,
}

const auditUserSelect = {
  id: true,
  name: true,
  role: true,
}

const outpassInclude = {
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

const getStartOfDay = (value = new Date()) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const getDayRange = (value = new Date()) => {
  const start = getStartOfDay(value)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

const toDate = (value) => {
  if (!value) {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const combineDateAndTime = (dateValue, timeValue) => {
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

const resolveOutpassDateTimes = (payload = {}) => {
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

const deriveMonitoringState = (outpass, latestMovement, now = new Date()) => {
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

  if (outpass.status === "expired") {
    return latestMovement?.action === "exit" && latestMovement?.createdAt >= outpass.outDate ? "overdue" : "expired"
  }

  if (outpass.status === "approved") {
    if (latestMovement?.action === "exit" && latestMovement?.createdAt >= outpass.outDate) {
      return "ongoing"
    }

    if (outpass.outDate > now) {
      return "approved"
    }

    return "awaiting_exit"
  }

  return outpass.status
}

const buildOutpassResponse = (outpass, options = {}) => {
  const latestMovement = options.latestMovement || null
  const auditTrail = Array.isArray(outpass.auditTrail) ? outpass.auditTrail.map(serializeAuditItem) : []
  const requestAudit = auditTrail.find((item) => item.status === "pending") || null
  const latestAudit = auditTrail.length > 0 ? auditTrail[auditTrail.length - 1] : null
  const monitoringState = deriveMonitoringState(outpass, latestMovement)
  const timeRemainingMs = outpass.actualReturnDate
    ? 0
    : Math.max(0, new Date(outpass.expectedReturnDate).getTime() - Date.now())

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
    status: outpass.status,
    rejectionReason: outpass.rejectionReason,
    emergencyContactName: outpass.emergencyContactName,
    emergencyContactPhone: outpass.emergencyContactPhone,
    emergencyContact: buildEmergencyContact(outpass),
    approvedById: outpass.approvedById,
    remarks: requestAudit?.remarks || null,
    latestStatusRemark: latestAudit?.remarks || null,
    monitoringState,
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

const getLatestMovementMap = async (prisma, userIds = []) => {
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
    orderBy: [
      { createdAt: "desc" },
      { id: "desc" },
    ],
  })

  const movementMap = new Map()

  for (const log of logs) {
    if (!movementMap.has(log.userId)) {
      movementMap.set(log.userId, log)
    }
  }

  return movementMap
}

const expireOldOutpasses = async (prisma) => {
  const now = new Date()
  const startOfToday = getStartOfDay(now)

  const expiredCandidates = await prisma.outpass.findMany({
    where: {
      status: {
        in: ["pending", "approved"],
      },
      actualReturnDate: null,
      OR: [
        {
          expectedReturnDate: {
            lt: now,
          },
        },
        {
          outDate: {
            lt: startOfToday,
          },
        },
      ],
    },
    select: {
      id: true,
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
            ? "Request auto-expired before approval window ended"
            : "Outpass auto-expired after expected return time elapsed",
      })),
    }),
  ])

  return outpassIds.length
}

module.exports = {
  userSelect,
  approverSelect,
  outpassInclude,
  getStartOfDay,
  getDayRange,
  toDate,
  combineDateAndTime,
  resolveOutpassDateTimes,
  buildOutpassResponse,
  deriveMonitoringState,
  getLatestMovementMap,
  expireOldOutpasses,
}
