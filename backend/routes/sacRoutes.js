const express = require("express")
const { getPrismaClient } = require("../config/prisma")
const { authenticate, authorize } = require("../middleware/auth")
const { generateId } = require("../utils/hashGenerator")
const { SAC_CLUB_ROOMS, SAC_EQUIPMENT, resolveClubRoom, resolveEquipment } = require("../utils/sacCatalog")
const { isSacOpenAt, SAC_CLOSE_LABEL } = require("../utils/campusActivityRules")

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

const buildRoomState = (roomName, session) => {
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
    occupants,
  }
}

const buildEquipmentState = (equipmentName, checkouts) => ({
  name: equipmentName,
  activeCount: checkouts.length,
  checkedOutBy: checkouts.map((checkout) => ({
    id: checkout.id,
    checkedOutAt: checkout.checkedOutAt,
    user: buildStudentSummary(checkout.user),
  })),
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

const getOverview = async (userId) => {
  const [activeSessions, activeCheckouts, myActivePresences, myActiveEquipment] = await prisma.$transaction([
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
        userId,
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
        userId,
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
      include: activeEquipmentInclude,
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

  const rooms = SAC_CLUB_ROOMS.map((roomName) => buildRoomState(roomName, activeSessionMap.get(roomName) || null))
  const equipment = SAC_EQUIPMENT.map((equipmentName) =>
    buildEquipmentState(equipmentName, equipmentMap.get(equipmentName) || []),
  )

  const activityFeed = [
    ...activeSessions.map((session) => ({
      type: "room_opened",
      timestamp: session.openedAt,
      title: `${session.roomName} opened`,
      subtitle: `${session.openedBy.name} opened the room`,
      roomName: session.roomName,
    })),
    ...activeSessions.flatMap((session) =>
      session.presences
        .filter((presence) => presence.userId !== session.openedByUserId)
        .map((presence) => ({
          type: "room_joined",
          timestamp: presence.joinedAt,
          title: `${presence.user.name} joined ${session.roomName}`,
          subtitle: `${session.presences.length} student${session.presences.length === 1 ? "" : "s"} inside now`,
          roomName: session.roomName,
        })),
    ),
    ...activeCheckouts.map((checkout) => ({
      type: "equipment_checked_out",
      timestamp: checkout.checkedOutAt,
      title: `${checkout.user.name} took ${checkout.equipmentName}`,
      subtitle: `${(equipmentMap.get(checkout.equipmentName) || []).length} active checkout${
        (equipmentMap.get(checkout.equipmentName) || []).length === 1 ? "" : "s"
      }`,
      equipmentName: checkout.equipmentName,
    })),
  ]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 15)

  return {
    summary: {
      openRooms: rooms.filter((room) => room.isOpen).length,
      studentsInRooms: rooms.reduce((count, room) => count + room.presentCount, 0),
      equipmentInUse: activeCheckouts.length,
      activeEquipmentTypes: equipment.filter((item) => item.activeCount > 0).length,
    },
    rooms,
    equipment,
    myStatus: {
      activeRooms: myActivePresences.map((presence) => buildRoomState(presence.session.roomName, presence.session)),
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
    },
  }
}

router.get("/overview", authenticate, async (req, res) => {
  try {
    const overview = await getOverview(req.user.userId)
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

    const overview = await getOverview(req.user.userId)
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

    const overview = await getOverview(req.user.userId)
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

    const overview = await getOverview(req.user.userId)
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

    const overview = await getOverview(req.user.userId)
    res.json({ message: `${equipmentName} returned.`, overview })
  } catch (error) {
    console.error("SAC equipment return error:", error)
    res.status(500).json({ message: "Server error returning equipment" })
  }
})

module.exports = router
