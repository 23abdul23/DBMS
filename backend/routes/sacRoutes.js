const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate, authorize } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")
const { SAC_CLUB_ROOMS, SAC_EQUIPMENT, resolveClubRoom, resolveEquipment } = require("../utils/sacCatalog")
const { isSacOpenAt, SAC_CLOSE_LABEL } = require("../utils/campusActivityRules")
const { canViewFullSacActivity } = require("../utils/adminScopes")

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
  const occupants = session?.presences?.map((presence) => ({
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
    isCurrentUserInside: Boolean(viewerUserId) && occupants.some((occupant) => occupant.user?.id === viewerUserId),
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
    isCheckedOutByCurrentUser: Boolean(viewerUserId) && checkedOutBy.some((entry) => entry.user?.id === viewerUserId),
    checkedOutBy,
  }
}

const buildSacActivityFeed = (logs, includeUserDetails) =>
  logs.map((log) => {
    const roomName = log.details?.roomName || null
    const equipmentName = log.details?.equipmentName || null
    const actorName = includeUserDetails ? log.user?.name || "Student" : "A student"
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
        title: includeUserDetails ? `${actorName} opened ${roomName}` : `${roomName} opened`,
        subtitle,
        roomName,
        user: includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_room_joined") {
      return {
        id: log.id,
        type: "room_joined",
        timestamp: log.createdAt,
        title: includeUserDetails ? `${actorName} joined ${roomName}` : `Student joined ${roomName}`,
        subtitle,
        roomName,
        user: includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_room_left") {
      return {
        id: log.id,
        type: "room_left",
        timestamp: log.createdAt,
        title: includeUserDetails ? `${actorName} left ${roomName}` : `Student left ${roomName}`,
        subtitle,
        roomName,
        user: includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    if (log.action === "sac_equipment_returned") {
      return {
        id: log.id,
        type: "equipment_returned",
        timestamp: log.createdAt,
        title: includeUserDetails ? `${actorName} returned ${equipmentName}` : `${equipmentName} returned`,
        subtitle,
        equipmentName,
        user: includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
      }
    }

    return {
      id: log.id,
      type: "equipment_checked_out",
      timestamp: log.createdAt,
      title: includeUserDetails ? `${actorName} took ${equipmentName}` : `${equipmentName} checked out`,
      subtitle,
      equipmentName,
      user: includeUserDetails && log.user ? buildStudentSummary(log.user) : null,
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

const createSacLog = async (client, { userId, action, description, details = {} }) =>
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

const getSacClosedMessage = () => `SAC is closed. It remains open till ${SAC_CLOSE_LABEL}.`

const getOverview = async (viewer) => {
  const includeUserDetails = canViewFullSacActivity(viewer)
  const viewerUserId = viewer?.userId || viewer?.id || null

  const [activeSessions, activeCheckouts, myActivePresences, myActiveEquipment, recentActivityLogs] = await prisma.$transaction([
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

  const activeSessionMap = new Map(activeSessions.map((session) => [session.roomName, session]))
  const equipmentMap = new Map()

  for (const checkout of activeCheckouts) {
    if (!equipmentMap.has(checkout.equipmentName)) {
      equipmentMap.set(checkout.equipmentName, [])
    }

    equipmentMap.get(checkout.equipmentName).push(checkout)
  }

  const rooms = SAC_CLUB_ROOMS.map((roomName) =>
    buildRoomState(roomName, activeSessionMap.get(roomName) || null, viewerUserId),
  )
  const equipment = SAC_EQUIPMENT.map((equipmentName) =>
    buildEquipmentState(equipmentName, equipmentMap.get(equipmentName) || [], viewerUserId),
  )
  const activityFeed = buildSacActivityFeed(recentActivityLogs, includeUserDetails).slice(0, 15)

  return {
    summary: {
      openRooms: rooms.filter((room) => room.isOpen).length,
      studentsInRooms: rooms.reduce((count, room) => count + room.presentCount, 0),
      equipmentInUse: activeCheckouts.length,
      activeEquipmentTypes: equipment.filter((item) => item.activeCount > 0).length,
    },
    rooms: rooms.map((room) => sanitizeRoomState(room, includeUserDetails)),
    equipment: equipment.map((item) => sanitizeEquipmentState(item, includeUserDetails)),
    myStatus: {
      activeRooms: myActivePresences
        .map((presence) => buildRoomState(presence.session.roomName, presence.session, viewerUserId))
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

router.post("/rooms/:roomName/select", [authenticate, authorize("student")], async (req, res) => {
  try {
    if (!isSacOpenAt()) {
      return res.status(403).json({ message: getSacClosedMessage(), code: "SAC_CLOSED" })
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
          },
        })
      })

      message = `${roomName} opened successfully.`
    } else {
      const alreadyInside = existingSession.presences.some((presence) => presence.userId === req.user.userId)

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
})

router.post("/rooms/:roomName/leave", [authenticate, authorize("student")], async (req, res) => {
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
      return res.status(404).json({ message: `You are not marked inside ${roomName}.` })
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
        data: remainingOccupants === 0 ? { closedAt: now, lastActivityAt: now } : { lastActivityAt: now },
      })

      await createSacLog(tx, {
        userId: req.user.userId,
        action: "sac_room_left",
        description: `Left ${roomName} room`,
        details: {
          roomName,
        },
      })
    })

    const overview = await getOverview(req.user)
    res.json({ message: `Left ${roomName}.`, overview })
  } catch (error) {
    console.error("SAC room leave error:", error)
    res.status(500).json({ message: "Server error leaving room" })
  }
})

router.post("/equipment/:equipmentName/select", [authenticate, authorize("student")], async (req, res) => {
  try {
    if (!isSacOpenAt()) {
      return res.status(403).json({ message: getSacClosedMessage(), code: "SAC_CLOSED" })
    }

    const equipmentName = resolveEquipment(req.params.equipmentName)

    if (!equipmentName) {
      return res.status(400).json({ message: "Invalid equipment selected." })
    }

    const existingCheckout = await prisma.sacEquipmentCheckout.findFirst({
      where: {
        userId: req.user.userId,
        equipmentName,
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
    })

    if (!existingCheckout) {
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
          },
        })
      })
    }

    const overview = await getOverview(req.user)
    res.json({
      message: existingCheckout ? `You already have ${equipmentName}.` : `${equipmentName} marked as taken.`,
      overview,
    })
  } catch (error) {
    console.error("SAC equipment select error:", error)
    res.status(500).json({ message: "Server error updating equipment activity" })
  }
})

router.post("/equipment/:equipmentName/return", [authenticate, authorize("student")], async (req, res) => {
  try {
    const equipmentName = resolveEquipment(req.params.equipmentName)

    if (!equipmentName) {
      return res.status(400).json({ message: "Invalid equipment selected." })
    }

    const activeCheckout = await prisma.sacEquipmentCheckout.findFirst({
      where: {
        userId: req.user.userId,
        equipmentName,
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
    })

    if (!activeCheckout) {
      return res.status(404).json({ message: `You do not have ${equipmentName} checked out.` })
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
        description: `Returned ${equipmentName}`,
        details: {
          equipmentName,
        },
      })
    })

    const overview = await getOverview(req.user)
    res.json({ message: `${equipmentName} returned.`, overview })
  } catch (error) {
    console.error("SAC equipment return error:", error)
    res.status(500).json({ message: "Server error returning equipment" })
  }
})

module.exports = router
