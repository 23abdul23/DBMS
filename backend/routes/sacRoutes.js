import express from "express"
import { getPrismaClient } from "../config/prisma.js"
import { authenticate, authorize } from "../middleware/auth.js"
import { generateId } from "../utils/hashGenerator.js"
import {
  SAC_CLUB_ROOMS,
  SAC_EQUIPMENT,
  resolveClubRoom,
  resolveEquipment,
} from "../utils/sacCatalog.js"
import { isSacOpenAt, SAC_CLOSE_LABEL } from "../utils/campusActivityRules.js"
import {
  canViewFullSacActivity,
  isSacAdministrator,
} from "../utils/adminScopes.js"
import proximityValidator from "../utils/proximityValidator.js"

const prisma = getPrismaClient()
const router = express.Router()

const sacUserSelect = {
  id: true,
  name: true,
  studentId: true,
  hostel: true,
  roomNumber: true,
  department: true,
  year: true,
  profilePhoto: true,
}

const activeRoomInclude = {
  openedBy: {
    select: sacUserSelect,
  },
  presences: {
    where: {
      leftAt: null,
    },
    orderBy: [{ joinedAt: "asc" }, { id: "asc" }],
    include: {
      user: {
        select: sacUserSelect,
      },
    },
  },
}

const activeEquipmentInclude = {
  user: {
    select: sacUserSelect,
  },
}

const sacLogUserSelect = {
  id: true,
  name: true,
  studentId: true,
  hostel: true,
  roomNumber: true,
  department: true,
  year: true,
  profilePhoto: true,
}

const buildStudentSummary = (user) => ({
  id: user.id,
  name: user.name,
  studentId: user.studentId || null,
  hostel: user.hostel || null,
  roomNumber: user.roomNumber || null,
  department: user.department || null,
  year: user.year || null,
  profilePhoto: user.profilePhoto || null,
})

const buildRoomState = (roomName, session, viewerUserId = null) => {
  const occupants =
    session?.presences?.map((presence) => ({
      id: presence.id,
      joinedAt: presence.joinedAt,
      user: buildStudentSummary(presence.user),
    })) || []

  return {
    name: roomName,
    isOpen: Boolean(session),
    openedAt: session?.openedAt || null,
    lastActivityAt: session?.lastActivityAt || null,
    openedBy: session?.openedBy ? buildStudentSummary(session.openedBy) : null,
    presentCount: occupants.length,
    isCurrentUserInside:
      Boolean(viewerUserId) &&
      occupants.some((occupant) => occupant.user?.id === viewerUserId),
    occupants,
  }
}

const buildEquipmentState = (equipmentName, checkouts, viewerUserId = null) => {
  const checkedOutBy = checkouts.map((checkout) => ({
    id: checkout.id,
    checkedOutAt: checkout.checkedOutAt,
    user: buildStudentSummary(checkout.user),
  }))

  return {
    name: equipmentName,
    activeCount: checkouts.length,
    isCheckedOutByCurrentUser:
      Boolean(viewerUserId) &&
      checkedOutBy.some((entry) => entry.user?.id === viewerUserId),
    checkedOutBy,
  }
}

const buildSacActivityFeed = (logs, includeUserDetails) =>
  logs.map((log) => {
    const roomName = log.details?.roomName || null
    const equipmentName = log.details?.equipmentName || null
    const actorName = includeUserDetails
      ? log.user?.name || "Student"
      : "A student"
    const subtitle = includeUserDetails
      ? log.user?.studentId
        ? log.user.studentId
        : "Student activity"
      : "Student activity"

    if (log.action === "sac_room_opened") {
      return {
        id: log.id,
        type: "room_opened",
        timestamp: log.createdAt,
        title: includeUserDetails
          ? `${actorName} opened ${roomName}`
          : `${roomName} opened`,
        subtitle,
        roomName,
        user:
          includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_room_joined") {
      return {
        id: log.id,
        type: "room_joined",
        timestamp: log.createdAt,
        title: includeUserDetails
          ? `${actorName} joined ${roomName}`
          : `Student joined ${roomName}`,
        subtitle,
        roomName,
        user:
          includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_room_left") {
      return {
        id: log.id,
        type: "room_left",
        timestamp: log.createdAt,
        title: includeUserDetails
          ? `${actorName} left ${roomName}`
          : `Student left ${roomName}`,
        subtitle,
        roomName,
        user:
          includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_equipment_returned") {
      return {
        id: log.id,
        type: "equipment_returned",
        timestamp: log.createdAt,
        title: includeUserDetails
          ? `${actorName} took back ${equipmentName}`
          : `${equipmentName} returned`,
        subtitle,
        equipmentName,
        user:
          includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    return {
      id: log.id,
      type: "equipment_checked_out",
      timestamp: log.createdAt,
      title: includeUserDetails
        ? `${actorName} took ${equipmentName}`
        : `${equipmentName} checked out`,
      subtitle,
      equipmentName,
      user:
        includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
    }
  })

const sanitizeRoomState = (room, includeUserDetails) => ({
  ...room,
  openedBy: includeUserDetails ? room.openedBy : null,
  occupants: includeUserDetails ? room.occupants : [],
})

const sanitizeEquipmentState = (item, includeUserDetails) => ({
  ...item,
  checkedOutBy: includeUserDetails ? item.checkedOutBy : [],
})

const createSacLog = async (
  client,
  { userId, action, description, details = {} },
) =>
  client.log.create({
    data: {
      id: generateId(),
      userId,
      action,
      location: "SAC",
      success: true,
      details: {
        description,
        ...details,
      },
      scanType: "manual",
    },
  })

const getSacClosedMessage = () =>
  `SAC is closed. It remains open till ${SAC_CLOSE_LABEL}.`

const getOverview = async (viewer) => {
  const viewerUserId = viewer?.userId || viewer?.id || null

  let dbUser = null
  if (viewerUserId) {
    dbUser = await prisma.user.findUnique({
      where: { id: viewerUserId },
      select: { id: true, role: true, email: true },
    })
  }

  const includeUserDetails = canViewFullSacActivity(dbUser)
  // console.log("\n=== SAC PERMISSIONS DEBUG ===");
  // console.log("Token ID received:", viewerUserId);
  // console.log("User found in DB:", dbUser ? `Yes, Role: ${dbUser.role}` : "NULL");
  // console.log("Is Admin/Security?:", includeUserDetails);
  // console.log("===============================\n");

  const [
    activeSessions,
    activeCheckouts,
    myActivePresences,
    myActiveEquipment,
    recentActivityLogs,
  ] = await prisma.$transaction([
    prisma.sacRoomSession.findMany({
      where: {
        closedAt: null,
      },
      orderBy: [{ lastActivityAt: "desc" }, { openedAt: "desc" }],
      include: activeRoomInclude,
    }),
    prisma.sacEquipmentCheckout.findMany({
      where: {
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
      include: activeEquipmentInclude,
    }),
    prisma.sacRoomPresence.findMany({
      where: {
        userId: viewerUserId,
        leftAt: null,
        session: {
          closedAt: null,
        },
      },
      include: {
        session: {
          include: activeRoomInclude,
        },
      },
      orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
    }),
    prisma.sacEquipmentCheckout.findMany({
      where: {
        userId: viewerUserId,
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
      include: activeEquipmentInclude,
    }),
    prisma.log.findMany({
      where: {
        location: "SAC",
        action: {
          in: [
            "sac_room_opened",
            "sac_room_joined",
            "sac_room_left",
            "sac_equipment_taken",
            "sac_equipment_returned",
          ],
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      include: {
        user: {
          select: sacLogUserSelect,
        },
      },
    }),
  ])

  const activeSessionMap = new Map(
    activeSessions.map((session) => [session.roomName, session]),
  )
  const equipmentMap = new Map()

  for (const checkout of activeCheckouts) {
    if (!equipmentMap.has(checkout.equipmentName)) {
      equipmentMap.set(checkout.equipmentName, [])
    }

    equipmentMap.get(checkout.equipmentName).push(checkout)
  }

  const rooms = SAC_CLUB_ROOMS.map((roomName) =>
    buildRoomState(
      roomName,
      activeSessionMap.get(roomName) || null,
      viewerUserId,
    ),
  )
  const equipment = SAC_EQUIPMENT.map((equipmentName) =>
    buildEquipmentState(
      equipmentName,
      equipmentMap.get(equipmentName) || [],
      viewerUserId,
    ),
  )
  const activityFeed = buildSacActivityFeed(
    recentActivityLogs,
    includeUserDetails,
  ).slice(0, 15)

  return {
    summary: {
      openRooms: rooms.filter((room) => room.isOpen).length,
      studentsInRooms: rooms.reduce(
        (count, room) => count + room.presentCount,
        0,
      ),
      equipmentInUse: activeCheckouts.length,
      activeEquipmentTypes: equipment.filter((item) => item.activeCount > 0)
        .length,
    },
    rooms: rooms.map((room) => sanitizeRoomState(room, includeUserDetails)),
    equipment: equipment
      .map((item) => sanitizeEquipmentState(item, includeUserDetails))
      .slice(0, 15),
    myStatus: {
      activeRooms: myActivePresences
        .map((presence) =>
          buildRoomState(
            presence.session.roomName,
            presence.session,
            viewerUserId,
          ),
        )
        .map((room) => sanitizeRoomState(room, includeUserDetails)),
      activeEquipment: myActiveEquipment.map((checkout) => ({
        id: checkout.id,
        name: checkout.equipmentName,
        checkedOutAt: checkout.checkedOutAt,
      })),
    },
    activityFeed,
    meta: {
      isOpenNow: isSacOpenAt(),
      closesAt: SAC_CLOSE_LABEL,
      viewerCanSeeDetails: includeUserDetails,
    },
  }
}

const fetchSacLocation = async () => {
  try {
    const loc = await prisma.location.findFirst({
      where: { name: "SAC", isActive: true },
      select: { latitude: true, longitude: true },
    })

    return loc || null
  } catch (e) {
    console.error("Error fetching SAC location:", e)
    return null
  }
}

router.get("/status", authenticate, async (req, res) => {
  try {
    if (!isSacOpenAt()) {
      return res.status(403).json({
        message: getSacClosedMessage(),
        code: "SAC_CLOSED",
        status: false,
        closesAt: SAC_CLOSE_LABEL,
      })
    }

    return res.status(200).json({
      message: `SAC is open till ${SAC_CLOSE_LABEL}.`,
      code: "SAC_OPEN",
      status: true,
      closesAt: SAC_CLOSE_LABEL,
    })
  } catch (error) {
    console.error("SAC status error:", error)
    return res.status(500).json({
      message: "Server error fetching SAC status",
      code: "SAC_STATUS_ERROR",
      status: false,
    })
  }
})

router.get("/overview", authenticate, async (req, res) => {
  try {
    const overview = await getOverview(req.user)
    res.json({
      overview,
      catalog: {
        rooms: SAC_CLUB_ROOMS,
        equipment: SAC_EQUIPMENT,
      },
    })
  } catch (error) {
    console.error("SAC overview error:", error)
    res.status(500).json({ message: "Server error fetching SAC overview" })
  }
})

router.post(
  "/rooms/:roomName/select",
  [authenticate, authorize("student")],
  async (req, res) => {
    try {
      if (!isSacOpenAt()) {
        return res
          .status(403)
          .json({ message: getSacClosedMessage(), code: "SAC_CLOSED" })
      }

      // Proximity validation: require user's coordinates (prod) and validate against SAC location
      const { latitude, longitude } = req.body || {}
      const sacLoc = await fetchSacLocation()
      if (
        (
          process.env.ENVIRONEMENT ||
          process.env.NODE_ENV ||
          "development"
        ).toLowerCase() === "production"
      ) {
        if (!sacLoc) {
          return res
            .status(500)
            .json({ message: "SAC location not configured" })
        }

        if (!latitude || !longitude) {
          return res.status(400).json({
            message: "Location coordinates required",
            code: "MISSING_COORDS",
          })
        }

        const { isWithin, distance } = proximityValidator.isWithinProximity(
          { latitude, longitude },
          sacLoc,
        )

        if (!isWithin) {
          try {
            await prisma.log.create({
              data: {
                id: generateId(),
                userId: req.user.userId,
                action: "scan_attempt",
                location: "SAC",
                success: false,
                details: {
                  attemptedAt: new Date(),
                  latitude,
                  longitude,
                  distance,
                },
                scanType: "manual",
              },
            })
          } catch (e) {
            console.error("Failed to log proximity failure:", e)
          }

          return res.status(403).json({
            code: "LOCATION_OUT_OF_RANGE",
            message: "You are trying to access this QR from a remote location",
          })
        }
      }

      const roomName = resolveClubRoom(req.params.roomName)

      if (!roomName) {
        return res.status(400).json({ message: "Invalid club room selected." })
      }

      const activePresence = await prisma.sacRoomPresence.findFirst({
        where: {
          userId: req.user.userId,
          leftAt: null,
          session: {
            closedAt: null,
          },
        },
        include: {
          session: true,
        },
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      })

      if (activePresence && activePresence.session.roomName !== roomName) {
        return res.status(400).json({
          message: `You are already marked inside ${activePresence.session.roomName}. Leave that room first.`,
        })
      }

      const existingSession = await prisma.sacRoomSession.findFirst({
        where: {
          roomName,
          closedAt: null,
        },
        orderBy: [{ openedAt: "desc" }, { id: "desc" }],
        include: activeRoomInclude,
      })

      let message = ""

      if (!existingSession) {
        await prisma.$transaction(async (tx) => {
          const now = new Date()
          const sessionId = generateId()

          await tx.sacRoomSession.create({
            data: {
              id: sessionId,
              roomName,
              openedByUserId: req.user.userId,
              openedAt: now,
              lastActivityAt: now,
            },
          })

          await tx.sacRoomPresence.create({
            data: {
              id: generateId(),
              sessionId,
              userId: req.user.userId,
              joinedAt: now,
            },
          })

          await createSacLog(tx, {
            userId: req.user.userId,
            action: "sac_room_opened",
            description: `Opened ${roomName} room`,
            details: {
              roomName,
              latitude: latitude || null,
              longitude: longitude || null,
            },
          })
        })

        message = `${roomName} opened successfully.`
      } else {
        const alreadyInside = existingSession.presences.some(
          (presence) => presence.userId === req.user.userId,
        )

        if (alreadyInside) {
          message = `You are already marked inside ${roomName}.`
        } else {
          await prisma.$transaction(async (tx) => {
            const now = new Date()

            await tx.sacRoomPresence.create({
              data: {
                id: generateId(),
                sessionId: existingSession.id,
                userId: req.user.userId,
                joinedAt: now,
              },
            })

            await tx.sacRoomSession.update({
              where: {
                id: existingSession.id,
              },
              data: {
                lastActivityAt: now,
              },
            })

            await createSacLog(tx, {
              userId: req.user.userId,
              action: "sac_room_joined",
              description: `Joined ${roomName} room`,
              details: {
                roomName,
                latitude: latitude || null,
                longitude: longitude || null,
              },
            })
          })

          message = `Joined ${roomName}.`
        }
      }

      const overview = await getOverview(req.user)
      res.json({ message, overview })
    } catch (error) {
      console.error("SAC room select error:", error)
      res.status(500).json({ message: "Server error updating room activity" })
    }
  },
)

router.post(
  "/rooms/:roomName/leave",
  [authenticate, authorize("student")],
  async (req, res) => {
    try {
      const roomName = resolveClubRoom(req.params.roomName)

      if (!roomName) {
        return res.status(400).json({ message: "Invalid club room selected." })
      }

      const activePresence = await prisma.sacRoomPresence.findFirst({
        where: {
          userId: req.user.userId,
          leftAt: null,
          session: {
            roomName,
            closedAt: null,
          },
        },
        include: {
          session: true,
        },
        orderBy: [{ joinedAt: "desc" }, { id: "desc" }],
      })

      if (!activePresence) {
        return res
          .status(404)
          .json({ message: `You are not marked inside ${roomName}.` })
      }

      await prisma.$transaction(async (tx) => {
        const now = new Date()

        await tx.sacRoomPresence.update({
          where: {
            id: activePresence.id,
          },
          data: {
            leftAt: now,
          },
        })

        const remainingOccupants = await tx.sacRoomPresence.count({
          where: {
            sessionId: activePresence.sessionId,
            leftAt: null,
          },
        })

        await tx.sacRoomSession.update({
          where: {
            id: activePresence.sessionId,
          },
          data:
            remainingOccupants === 0
              ? { closedAt: now, lastActivityAt: now }
              : { lastActivityAt: now },
        })

        await createSacLog(tx, {
          userId: req.user.userId,
          action: "sac_room_left",
          description: `Left ${roomName} room`,
          details: {
            roomName,
            latitude: req.body?.latitude || null,
            longitude: req.body?.longitude || null,
          },
        })
      })

      const overview = await getOverview(req.user)
      res.json({ message: `Left ${roomName}.`, overview })
    } catch (error) {
      console.error("SAC room leave error:", error)
      res.status(500).json({ message: "Server error leaving room" })
    }
  },
)

router.post(
  "/equipment/:equipmentName/select",
  [authenticate, authorize("student")],
  async (req, res) => {
    try {
      if (!isSacOpenAt()) {
        return res
          .status(403)
          .json({ message: getSacClosedMessage(), code: "SAC_CLOSED" })
      }

      // Proximity validation for equipment actions
      const { latitude, longitude } = req.body || {}
      const sacLoc = await fetchSacLocation()
      if (
        (
          process.env.ENVIRONEMENT ||
          process.env.NODE_ENV ||
          "development"
        ).toLowerCase() === "production"
      ) {
        if (!sacLoc) {
          return res
            .status(500)
            .json({ message: "SAC location not configured" })
        }

        if (!latitude || !longitude) {
          return res.status(400).json({
            message: "Location coordinates required",
            code: "MISSING_COORDS",
          })
        }

        const { isWithin, distance } = proximityValidator.isWithinProximity(
          { latitude, longitude },
          sacLoc,
        )

        if (!isWithin) {
          try {
            await prisma.log.create({
              data: {
                id: generateId(),
                userId: req.user.userId,
                action: "scan_attempt",
                location: "SAC",
                success: false,
                details: {
                  attemptedAt: new Date(),
                  latitude,
                  longitude,
                  distance,
                },
                scanType: "manual",
              },
            })
          } catch (e) {
            console.error("Failed to log proximity failure:", e)
          }

          return res.status(403).json({
            code: "LOCATION_OUT_OF_RANGE",
            message: "You are trying to access this QR from a remote location",
          })
        }
      }

      const equipmentName = resolveEquipment(req.params.equipmentName)

      if (!equipmentName) {
        return res.status(400).json({ message: "Invalid equipment selected." })
      }

      const existingCheckout = await prisma.sacEquipmentCheckout.findFirst({
        where: {
          userId: req.user.userId,
          returnedAt: null,
        },
        orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
      })

      if (existingCheckout) {
        const overview = await getOverview(req.user)

        if (existingCheckout.equipmentName === equipmentName) {
          return res.json({
            message: `You already have ${equipmentName}.`,
            overview,
          })
        }

        return res.status(409).json({
          code: "ACTIVE_EQUIPMENT_EXISTS",
          message: `You already have ${existingCheckout.equipmentName}. SAC admin must mark it returned before you can take another item.`,
          overview,
        })
      }

      await prisma.$transaction(async (tx) => {
        await tx.sacEquipmentCheckout.create({
          data: {
            id: generateId(),
            equipmentName,
            userId: req.user.userId,
          },
        })

        await createSacLog(tx, {
          userId: req.user.userId,
          action: "sac_equipment_taken",
          description: `Took ${equipmentName}`,
          details: {
            equipmentName,
            latitude: latitude || null,
            longitude: longitude || null,
          },
        })
      })

      const overview = await getOverview(req.user)
      res.json({
        message: `${equipmentName} marked as taken.`,
        overview,
      })
    } catch (error) {
      console.error("SAC equipment select error:", error)
      res
        .status(500)
        .json({ message: "Server error updating equipment activity" })
    }
  },
)

router.post(
  "/equipment/:equipmentName/return",
  authenticate,
  async (req, res) => {
    try {
      if (!isSacAdministrator(req.user)) {
        return res
          .status(403)
          .json({ message: "Only SAC admin can mark equipment as returned." })
      }

      const equipmentName = resolveEquipment(req.params.equipmentName)

      if (!equipmentName) {
        return res.status(400).json({ message: "Invalid equipment selected." })
      }

      const { checkoutId, userId } = req.body || {}
      let activeCheckout = null

      if (checkoutId) {
        activeCheckout = await prisma.sacEquipmentCheckout.findUnique({
          where: { id: checkoutId },
          include: activeEquipmentInclude,
        })
      } else if (userId) {
        activeCheckout = await prisma.sacEquipmentCheckout.findFirst({
          where: {
            userId,
            equipmentName,
            returnedAt: null,
          },
          orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
          include: activeEquipmentInclude,
        })
      } else {
        const activeCheckouts = await prisma.sacEquipmentCheckout.findMany({
          where: {
            equipmentName,
            returnedAt: null,
          },
          orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
          include: activeEquipmentInclude,
        })

        if (activeCheckouts.length === 1) {
          activeCheckout = activeCheckouts[0]
        } else if (activeCheckouts.length > 1) {
          return res.status(400).json({
            message:
              "Multiple active checkouts exist. Please provide checkoutId or userId to return a specific item.",
          })
        }
      }

      if (!activeCheckout || activeCheckout.returnedAt !== null) {
        return res
          .status(404)
          .json({ message: `No active checkout found for ${equipmentName}.` })
      }

      await prisma.$transaction(async (tx) => {
        await tx.sacEquipmentCheckout.update({
          where: {
            id: activeCheckout.id,
          },
          data: {
            returnedAt: new Date(),
          },
        })

        await createSacLog(tx, {
          userId: req.user.userId,
          action: "sac_equipment_returned",
          description: `Marked ${equipmentName} returned for ${activeCheckout.user?.name || "student"}`,
          details: {
            equipmentName,
            checkoutId: activeCheckout.id,
            returnedForUserId: activeCheckout.userId,
            studentId: activeCheckout.user?.studentId || null,
            latitude: req.body?.latitude || null,
            longitude: req.body?.longitude || null,
          },
        })
      })

      const overview = await getOverview(req.user)
      res.json({
        message: `${equipmentName} marked returned for ${activeCheckout.user?.name || "student"}.`,
        overview,
      })
    } catch (error) {
      console.error("SAC equipment return error:", error)
      res.status(500).json({ message: "Server error returning equipment" })
    }
  },
)

export default router
