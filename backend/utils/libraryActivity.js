const { generateId } = require("./hashGenerator")
const { getLibraryLimit } = require("./campusActivityRules")

const LIBRARY_LOCATION = "Library"

const libraryUserSelect = {
  id: true,
  name: true,
  studentId: true,
  hostel: true,
  roomNumber: true,
  department: true,
  year: true,
  profilePhoto: true,
}

const buildLibraryStudentSummary = (user) => ({
  id: user.id,
  name: user.name,
  studentId: user.studentId || null,
  hostel: user.hostel || null,
  roomNumber: user.roomNumber || null,
  department: user.department || null,
  year: user.year || null,
  profilePhoto: user.profilePhoto || null,
})

const activeSeatInclude = {
  user: {
    select: libraryUserSelect,
  },
}

const getActiveSeatSession = async (client, userId) =>
  client.librarySeatSession.findFirst({
    where: {
      userId,
      leftAt: null,
    },
    include: activeSeatInclude,
    orderBy: [{ enteredAt: "desc" }, { id: "desc" }],
  })

const getSeatSessionByNumber = async (client, seatNumber) =>
  client.librarySeatSession.findFirst({
    where: {
      seatNumber,
      leftAt: null,
    },
    include: activeSeatInclude,
    orderBy: [{ enteredAt: "asc" }, { id: "asc" }],
  })

const getLibraryOverview = async (client, userId) => {
  const limit = getLibraryLimit()
  const [activeSeats, activityLogs, myActiveSeat] = await Promise.all([
    client.librarySeatSession.findMany({
      where: {
        leftAt: null,
      },
      include: activeSeatInclude,
      orderBy: [{ enteredAt: "asc" }, { seatNumber: "asc" }, { id: "asc" }],
    }),
    client.log.findMany({
      where: {
        action: {
          in: ["library_seat_taken", "library_seat_released"],
        },
        location: LIBRARY_LOCATION,
      },
      include: {
        user: {
          select: libraryUserSelect,
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 15,
    }),
    userId ? getActiveSeatSession(client, userId) : Promise.resolve(null),
  ])

  return {
    summary: {
      capacity: limit,
      occupiedCount: activeSeats.length,
      availableCount: Math.max(0, limit - activeSeats.length),
      isFull: activeSeats.length >= limit,
    },
    myStatus: {
      activeSeat: myActiveSeat
        ? {
            id: myActiveSeat.id,
            seatNumber: myActiveSeat.seatNumber,
            enteredAt: myActiveSeat.enteredAt,
          }
        : null,
    },
    occupants: activeSeats.map((seat) => ({
      id: seat.id,
      seatNumber: seat.seatNumber,
      enteredAt: seat.enteredAt,
      user: buildLibraryStudentSummary(seat.user),
    })),
    activityFeed: activityLogs.map((log) => ({
      id: log.id,
      type: log.action,
      timestamp: log.createdAt,
      title:
        log.details?.description ||
        (log.action === "library_seat_released"
          ? `${log.user?.name || "Student"} released seat ${log.details?.seatNumber || ""}`.trim()
          : `${log.user?.name || "Student"} took seat ${log.details?.seatNumber || ""}`.trim()),
      subtitle: log.action === "library_seat_released" ? "Seat released" : "Seat occupied",
      seatNumber: log.details?.seatNumber || null,
      user: log.user ? buildLibraryStudentSummary(log.user) : null,
    })),
    meta: {
      limit,
    },
  }
}

const createSeatLog = async (client, { userId, action, seatNumber, createdAt, description, details = {} }) =>
  client.log.create({
    data: {
      id: generateId(),
      userId,
      action,
      location: LIBRARY_LOCATION,
      success: true,
      details: {
        seatNumber,
        description,
        ...details,
      },
      scanType: "manual",
      createdAt,
    },
  })

const claimLibrarySeat = async (client, { userId, seatNumber, timestamp = new Date(), details = {} }) => {
  const sessionId = generateId()

  await client.librarySeatSession.create({
    data: {
      id: sessionId,
      userId,
      seatNumber,
      enteredAt: timestamp,
      lastActivityAt: timestamp,
    },
  })

  await createSeatLog(client, {
    userId,
    action: "library_seat_taken",
    seatNumber,
    createdAt: timestamp,
    description: `Took the Token Number ${seatNumber} seat`,
    details,
  })

  return sessionId
}

const releaseLibrarySeat = async (client, { session, timestamp = new Date(), details = {} }) => {
  if (!session) {
    return null
  }

  await client.librarySeatSession.update({
    where: {
      id: session.id,
    },
    data: {
      leftAt: timestamp,
      lastActivityAt: timestamp,
    },
  })

  await createSeatLog(client, {
    userId: session.userId,
    action: "library_seat_released",
    seatNumber: session.seatNumber,
    createdAt: timestamp,
    description: `Released the Token Number ${session.seatNumber} seat`,
    details,
  })

  return session.id
}

module.exports = {
  LIBRARY_LOCATION,
  libraryUserSelect,
  buildLibraryStudentSummary,
  getActiveSeatSession,
  getSeatSessionByNumber,
  getLibraryOverview,
  claimLibrarySeat,
  releaseLibrarySeat,
}
