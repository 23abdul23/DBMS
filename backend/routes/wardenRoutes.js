import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate, authorize } from "../middleware/auth.js"
import { generateId } from "../utils/hashGenerator.js"
import {
  outpassInclude,
  buildOutpassResponse,
  getLatestMovementMap,
  getLatestGateMovementMap,
  getRecentMovementTrailMap,
  expireOldOutpasses,
  getDayRange,
  canCancelOutpass,
} from "../utils/outpassLifecycle.js"
import { requiresOutpassForExit } from "../utils/locationPolicy.js"

const prisma = getPrismaClient()
const router = express.Router()

const ensureHostelAssignment = (req, res) => {
  if (!req.user.hostel) {
    res
      .status(400)
      .json({ message: "This warden account is not assigned to a hostel yet" })
    return null
  }

  return req.user.hostel
}

const getSearchFilter = (search) => {
  if (!search || typeof search !== "string" || search.trim().length === 0) {
    return null
  }

  const value = search.trim()

  return {
    OR: [
      {
        reason: {
          contains: value,
          mode: "insensitive",
        },
      },
      {
        destination: {
          contains: value,
          mode: "insensitive",
        },
      },
      {
        rejectionReason: {
          contains: value,
          mode: "insensitive",
        },
      },
      {
        user: {
          is: {
            OR: [
              {
                name: {
                  contains: value,
                  mode: "insensitive",
                },
              },
              {
                email: {
                  contains: value,
                  mode: "insensitive",
                },
              },
              {
                studentId: {
                  contains: value,
                  mode: "insensitive",
                },
              },
              {
                roomNumber: {
                  contains: value,
                  mode: "insensitive",
                },
              },
            ],
          },
        },
      },
    ],
  }
}

const actionRemarks = {
  approve: "Approved by hostel warden",
  reject: "Rejected by hostel warden",
  cancel: "Cancelled by hostel warden",
}

const actionStatusMap = {
  approve: "approved",
  reject: "rejected",
  cancel: "cancelled",
}

const canCancelByWarden = (outpass, latestMovement) =>
  canCancelOutpass(outpass, latestMovement)

router.get(
  "/dashboard",
  [authenticate, authorize("warden")],
  async (req, res) => {
    try {
      const hostel = ensureHostelAssignment(req, res)
      if (!hostel) {
        return
      }

      await expireOldOutpasses(prisma)

      const { start, end } = getDayRange()

      const [
        totalStudents,
        pendingRequests,
        approvedRequests,
        expiredRequests,
        returnedToday,
        recentOutpasses,
        activeOutpasses,
      ] = await Promise.all([
        prisma.user.count({
          where: {
            role: "student",
            hostel,
          },
        }),
        prisma.outpass.count({
          where: {
            status: "pending",
            user: {
              is: {
                hostel,
              },
            },
          },
        }),
        prisma.outpass.count({
          where: {
            status: "approved",
            actualReturnDate: null,
            user: {
              is: {
                hostel,
              },
            },
          },
        }),
        prisma.outpass.count({
          where: {
            status: "expired",
            actualReturnDate: null,
            user: {
              is: {
                hostel,
              },
            },
          },
        }),
        prisma.outpass.count({
          where: {
            actualReturnDate: {
              gte: start,
              lt: end,
            },
            user: {
              is: {
                hostel,
              },
            },
          },
        }),
        prisma.outpass.findMany({
          where: {
            user: {
              is: {
                hostel,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 12,
          include: outpassInclude,
        }),
        prisma.outpass.findMany({
          where: {
            actualReturnDate: null,
            status: {
              in: ["pending", "approved", "expired"],
            },
            user: {
              is: {
                hostel,
              },
            },
          },
          orderBy: [{ outDate: "desc" }, { createdAt: "desc" }],
          include: outpassInclude,
          take: 200,
        }),
      ])

      const movementMap = await getLatestMovementMap(prisma, [
        ...recentOutpasses.map((item) => item.userId),
        ...activeOutpasses.map((item) => item.userId),
      ])
      const serializedOutpasses = recentOutpasses.map((item) =>
        buildOutpassResponse(item, {
          latestMovement: movementMap.get(item.userId),
        }),
      )
      const serializedActiveOutpasses = activeOutpasses.map((item) =>
        buildOutpassResponse(item, {
          latestMovement: movementMap.get(item.userId),
        }),
      )

      const ongoingCount = serializedActiveOutpasses.filter((item) =>
        ["ongoing", "yellow_alert", "danger", "long_visit_away"].includes(
          item.monitoringState,
        ),
      ).length
      const overdueRequests = serializedActiveOutpasses.filter(
        (item) => item.monitoringState === "overdue",
      ).length
      const yellowAlerts = serializedActiveOutpasses.filter(
        (item) => item.monitoringState === "yellow_alert",
      ).length
      const dangerAlerts = serializedActiveOutpasses.filter(
        (item) => item.monitoringState === "danger",
      ).length
      const recentPending = serializedOutpasses
        .filter((item) => item.status === "pending")
        .slice(0, 5)
      const activeMonitoring = serializedActiveOutpasses
        .filter((item) =>
          [
            "ongoing",
            "yellow_alert",
            "danger",
            "overdue",
            "awaiting_exit",
            "long_visit_away",
          ].includes(item.monitoringState),
        )
        .slice(0, 5)

      res.json({
        hostel,
        stats: {
          totalStudents,
          pendingRequests,
          approvedRequests,
          ongoingCount,
          expiredRequests,
          overdueRequests,
          yellowAlerts,
          dangerAlerts,
          returnedToday,
        },
        recentPending,
        activeMonitoring,
      })
    } catch (error) {
      console.error("Warden dashboard error:", error)
      res
        .status(500)
        .json({ message: "Server error fetching warden dashboard" })
    }
  },
)

router.get(
  "/outpasses",
  [authenticate, authorize("warden")],
  async (req, res) => {
    try {
      const hostel = ensureHostelAssignment(req, res)
      if (!hostel) {
        return
      }

      await expireOldOutpasses(prisma)

      const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1)
      const limit = Math.min(Number.parseInt(req.query.limit, 10) || 30, 100)
      const status =
        typeof req.query.status === "string"
          ? req.query.status.trim().toLowerCase()
          : ""
      const monitoringState =
        typeof req.query.monitoringState === "string"
          ? req.query.monitoringState.trim().toLowerCase()
          : ""

      const baseWhere = {
        user: {
          is: {
            hostel,
          },
        },
        ...(status ? { status } : {}),
        ...(getSearchFilter(req.query.search) || {}),
      }

      const outpasses = await prisma.outpass.findMany({
        where: baseWhere,
        orderBy: [{ createdAt: "desc" }, { outDate: "desc" }],
        include: outpassInclude,
        take: 250,
      })

      const movementMap = await getLatestMovementMap(
        prisma,
        outpasses.map((item) => item.userId),
      )

      let serializedOutpasses = outpasses.map((item) =>
        buildOutpassResponse(item, {
          latestMovement: movementMap.get(item.userId),
        }),
      )

      if (monitoringState) {
        serializedOutpasses = serializedOutpasses.filter(
          (item) => item.monitoringState === monitoringState,
        )
      }

      const total = serializedOutpasses.length
      const offset = (page - 1) * limit
      const paginatedOutpasses = serializedOutpasses.slice(
        offset,
        offset + limit,
      )

      const counts = serializedOutpasses.reduce(
        (accumulator, item) => {
          accumulator.byStatus[item.status] =
            (accumulator.byStatus[item.status] || 0) + 1
          accumulator.byMonitoring[item.monitoringState] =
            (accumulator.byMonitoring[item.monitoringState] || 0) + 1
          return accumulator
        },
        {
          byStatus: {},
          byMonitoring: {},
        },
      )

      res.json({
        hostel,
        outpasses: paginatedOutpasses,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        counts,
      })
    } catch (error) {
      console.error("Warden outpasses error:", error)
      res
        .status(500)
        .json({ message: "Server error fetching hostel outpasses" })
    }
  },
)

router.get(
  "/outpasses/:id",
  [authenticate, authorize("warden")],
  async (req, res) => {
    try {
      const hostel = ensureHostelAssignment(req, res)
      if (!hostel) {
        return
      }

      await expireOldOutpasses(prisma)

      const outpass = await prisma.outpass.findFirst({
        where: {
          id: req.params.id,
          user: {
            is: {
              hostel,
            },
          },
        },
        include: outpassInclude,
      })

      if (!outpass) {
        return res
          .status(404)
          .json({ message: "Outpass not found for this hostel" })
      }

      const movementMap = await getLatestMovementMap(prisma, [outpass.userId])

      res.json({
        outpass: buildOutpassResponse(outpass, {
          latestMovement: movementMap.get(outpass.userId),
        }),
      })
    } catch (error) {
      console.error("Warden outpass details error:", error)
      res.status(500).json({ message: "Server error fetching outpass details" })
    }
  },
)

router.patch(
  "/outpasses/:id/action",
  [authenticate, authorize("warden")],
  async (req, res) => {
    try {
      const hostel = ensureHostelAssignment(req, res)
      if (!hostel) {
        return
      }

      await expireOldOutpasses(prisma)

      const action = String(req.body.action || "")
        .trim()
        .toLowerCase()
      if (!["approve", "reject", "cancel"].includes(action)) {
        return res
          .status(400)
          .json({ message: "Action must be approve, reject, or cancel" })
      }

      const outpass = await prisma.outpass.findFirst({
        where: {
          id: req.params.id,
          user: {
            is: {
              hostel,
            },
          },
        },
        include: outpassInclude,
      })

      if (!outpass) {
        return res
          .status(404)
          .json({ message: "Outpass not found for this hostel" })
      }

      const movementMap = await getLatestMovementMap(prisma, [outpass.userId])
      const latestMovement = movementMap.get(outpass.userId)

      if (action === "approve" && outpass.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Only pending requests can be approved" })
      }

      if (action === "reject" && outpass.status !== "pending") {
        return res
          .status(400)
          .json({ message: "Only pending requests can be rejected" })
      }

      if (action === "cancel" && !canCancelByWarden(outpass, latestMovement)) {
        return res.status(400).json({
          message:
            "This outpass cannot be cancelled because the student has already left or the request is closed",
        })
      }

      const remarks =
        String(req.body.remarks || req.body.rejectionReason || "").trim() ||
        actionRemarks[action]
      const nextStatus = actionStatusMap[action]

      const updatedOutpass = await prisma.$transaction(async (tx) => {
        await tx.outpass.update({
          where: {
            id: outpass.id,
          },
          data: {
            status: nextStatus,
            approvedById: req.user.userId,
            rejectionReason: action === "reject" ? remarks : null,
          },
        })

        await tx.outpassAuditTrail.create({
          data: {
            id: generateId(),
            outpassId: outpass.id,
            status: nextStatus,
            changedBy: req.user.userId,
            changedAt: new Date(),
            remarks,
          },
        })

        await tx.log.create({
          data: {
            id: generateId(),
            userId: outpass.userId,
            action: "outpass_status_changed",
            success: true,
            details: {
              outpassId: outpass.id,
              requestType: outpass.requestType,
              previousStatus: outpass.status,
              nextStatus,
              source: "warden",
              changedBy: req.user.userId,
            },
            scanType: "manual",
          },
        })

        return tx.outpass.findUnique({
          where: {
            id: outpass.id,
          },
          include: outpassInclude,
        })
      })

      res.json({
        message: `Outpass ${nextStatus} successfully`,
        outpass: buildOutpassResponse(updatedOutpass, {
          latestMovement,
        }),
      })
    } catch (error) {
      console.error("Warden action error:", error)
      res.status(500).json({ message: "Server error updating outpass" })
    }
  },
)

router.get(
  "/monitoring",
  [authenticate, authorize("warden")],
  async (req, res) => {
    try {
      const hostel = ensureHostelAssignment(req, res)
      if (!hostel) {
        return
      }

      await expireOldOutpasses(prisma)

      const search =
        typeof req.query.search === "string"
          ? req.query.search.trim().toLowerCase()
          : ""
      const campusPresence =
        typeof req.query.campusPresence === "string"
          ? req.query.campusPresence.trim().toLowerCase()
          : ""
      const now = new Date()

      const students = await prisma.user.findMany({
        where: {
          role: "student",
          hostel,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          email: true,
          studentId: true,
          hostel: true,
          roomNumber: true,
          phoneNumber: true,
        },
      })

      const latestOutpasses = await prisma.outpass.findMany({
        where: {
          user: {
            is: {
              hostel,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { outDate: "desc" }],
        include: outpassInclude,
        take: 300,
      })

      const outpassMap = new Map()
      for (const item of latestOutpasses) {
        if (!outpassMap.has(item.userId)) {
          outpassMap.set(item.userId, item)
        }
      }

      const studentIds = students.map((item) => item.id)
      const [movementMap, gateMovementMap, movementTrailMap] =
        await Promise.all([
          getLatestMovementMap(prisma, studentIds),
          getLatestGateMovementMap(prisma, studentIds),
          getRecentMovementTrailMap(prisma, studentIds),
        ])

      let monitoring = students.map((student) => {
        const latestOutpass = outpassMap.get(student.id) || null
        const latestMovement = movementMap.get(student.id) || null
        const latestGateMovement = gateMovementMap.get(student.id) || null
        const recentMovements = (movementTrailMap.get(student.id) || []).map(
          (movement) => ({
            id: movement.id,
            action: movement.action,
            location: movement.location,
            guardName: movement.guardName,
            createdAt: movement.createdAt,
          }),
        )
        const outsideWithOutpass =
          Boolean(latestOutpass) &&
          ["approved", "expired"].includes(latestOutpass.status) &&
          !latestOutpass.actualReturnDate
        const isOutsideCampus = latestGateMovement?.action === "exit"
        const monitoringState = isOutsideCampus
          ? outsideWithOutpass
            ? "ongoing"
            : requiresOutpassForExit(latestGateMovement.location, now)
              ? "danger"
              : "yellow_alert"
          : "inside"

        return {
          student: {
            id: student.id,
            name: student.name,
            email: student.email,
            studentId: student.studentId,
            hostel: student.hostel,
            roomNumber: student.roomNumber,
            phoneNumber: student.phoneNumber,
          },
          campusPresence: isOutsideCampus ? "outside" : "inside",
          monitoringState,
          latestMovement: latestMovement
            ? {
                id: latestMovement.id,
                action: latestMovement.action,
                location: latestMovement.location,
                createdAt: latestMovement.createdAt,
                guardName: latestMovement.guardName,
              }
            : null,
          recentMovements,
          exitGate: isOutsideCampus ? latestGateMovement.location : null,
          exitTime: isOutsideCampus ? latestGateMovement.createdAt : null,
          hasOutpass: isOutsideCampus ? outsideWithOutpass : false,
          outpass:
            isOutsideCampus && latestOutpass
              ? buildOutpassResponse(latestOutpass, {
                  latestMovement,
                  now,
                })
              : null,
        }
      })

      if (search) {
        monitoring = monitoring.filter((item) => {
          const haystack = [
            item.student.name,
            item.student.email,
            item.student.studentId,
            item.student.roomNumber,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()

          return haystack.includes(search)
        })
      }

      if (campusPresence) {
        monitoring = monitoring.filter(
          (item) => item.campusPresence === campusPresence,
        )
      }

      const sortPriority = {
        danger: 1,
        yellow_alert: 2,
        ongoing: 3,
        inside: 4,
      }

      monitoring.sort((left, right) => {
        const leftPriority = sortPriority[left.monitoringState] || 99
        const rightPriority = sortPriority[right.monitoringState] || 99
        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority
        }

        return left.student.name.localeCompare(right.student.name)
      })

      // Counts for campus presence (inside/outside) should be computed
      // separately from monitoring state to avoid key collisions when
      // a monitoringState value matches a campusPresence value (e.g. 'inside').
      const counts = monitoring.reduce((accumulator, item) => {
        accumulator[item.campusPresence] =
          (accumulator[item.campusPresence] || 0) + 1
        return accumulator
      }, {})

      const monitoringCounts = monitoring.reduce((accumulator, item) => {
        accumulator[item.monitoringState] =
          (accumulator[item.monitoringState] || 0) + 1
        return accumulator
      }, {})

      res.json({
        hostel,
        monitoring,
        counts,
        monitoringCounts,
      })
    } catch (error) {
      console.error("Warden monitoring error:", error)
      res
        .status(500)
        .json({ message: "Server error fetching hostel monitoring" })
    }
  },
)

export default router
