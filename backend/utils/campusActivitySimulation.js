const { getPrismaClient } = require("../config/prisma")
const { generateId } = require("./hashGenerator")
const {
  EXIT_GATES,
  CAMPUS_BUILDINGS,
  HOSTELS,
  isExitGate,
  isCampusBuilding,
} = require("./locationPolicy")
const {
  OUTPASS_REQUEST_TYPE,
  RETURN_CUTOFF_HOUR,
  RETURN_CUTOFF_MINUTE,
  canCancelOutpass,
  canUseOutpass,
  expireOldOutpasses,
  getCutoffTimeForDate,
  getLatestGateMovementMap,
  getLatestMovementMap,
} = require("./outpassLifecycle")
const { SAC_CLUB_ROOMS, SAC_EQUIPMENT } = require("./sacCatalog")
const {
  CAMPUS_TIMEZONE,
  getLibraryLimit,
  getLocalizedMinutes,
  isLibOpenAt,
  isSacOpenAt,
} = require("./campusActivityRules")
const {
  LIBRARY_LOCATION,
  claimLibrarySeat,
  getActiveSeatSession,
  releaseLibrarySeat,
} = require("./libraryActivity")

const prisma = getPrismaClient()

const LIBRARY_TIMEZONE = CAMPUS_TIMEZONE
const LEGACY_SIMULATION_SOURCE = "library_cron_simulation"
const SIMULATION_SOURCE = "campus_cron_simulation"
const CLOSING_SWEEP_SOURCE = "campus_closing_sweep"
const MOVEMENT_SCAN_TYPE = "manual"

const ACADEMIC_BUILDINGS = CAMPUS_BUILDINGS.filter(
  (location) => location !== LIBRARY_LOCATION,
)
const REGULAR_OUTPASS_DESTINATIONS = [
  { reason: "Evening study materials pickup", destination: "City Book Store" },
  { reason: "Medical appointment", destination: "Community Clinic" },
  { reason: "Family dinner", destination: "Relative's Residence" },
  { reason: "Essential shopping", destination: "Market Square" },
  { reason: "Railway reservation work", destination: "Railway Station" },
  { reason: "Bank work", destination: "Central Bank Branch" },
]
const LONG_VISIT_DESTINATIONS = [
  { reason: "Weekend home visit", destination: "Family Residence" },
  { reason: "Family function", destination: "Home Town" },
  { reason: "Urgent family visit", destination: "Relative's Residence" },
]

const WINDOW_PROFILES = [
  {
    name: "night",
    startMinute: 0,
    endMinute: 390,
    hostelToAcademicRatio: 0,
    hostelToLibraryRatio: 0.002,
    academicToHostelRatio: 0.02,
    libraryToHostelRatio: 0.05,
    buildingShiftRatio: 0,
    outpassRequestRatio: 0.001,
    pendingReviewRatio: 0.01,
    gateDepartureRatio: 0,
    gateReturnRatio: 0.03,
    maxHostelToAcademic: 0,
    maxHostelToLibrary: 1,
    maxAcademicToHostel: 3,
    maxLibraryToHostel: 5,
    maxBuildingShifts: 0,
    maxOutpassRequests: 1,
    maxPendingReviews: 2,
    maxGateDepartures: 0,
    maxGateReturns: 4,
  },
  {
    name: "morning_prep",
    startMinute: 390,
    endMinute: 525,
    hostelToAcademicRatio: 0.03,
    hostelToLibraryRatio: 0.004,
    academicToHostelRatio: 0.01,
    libraryToHostelRatio: 0.015,
    buildingShiftRatio: 0.005,
    outpassRequestRatio: 0.002,
    pendingReviewRatio: 0.015,
    gateDepartureRatio: 0.002,
    gateReturnRatio: 0.01,
    maxHostelToAcademic: 8,
    maxHostelToLibrary: 2,
    maxAcademicToHostel: 4,
    maxLibraryToHostel: 3,
    maxBuildingShifts: 2,
    maxOutpassRequests: 2,
    maxPendingReviews: 3,
    maxGateDepartures: 1,
    maxGateReturns: 2,
  },
  {
    name: "morning_classes",
    startMinute: 525,
    endMinute: 780,
    hostelToAcademicRatio: 0.055,
    hostelToLibraryRatio: 0.004,
    academicToHostelRatio: 0.018,
    libraryToHostelRatio: 0.02,
    buildingShiftRatio: 0.01,
    outpassRequestRatio: 0.008,
    pendingReviewRatio: 0.02,
    gateDepartureRatio: 0.002,
    gateReturnRatio: 0.012,
    maxHostelToAcademic: 18,
    maxHostelToLibrary: 2,
    maxAcademicToHostel: 8,
    maxLibraryToHostel: 4,
    maxBuildingShifts: 4,
    maxOutpassRequests: 2,
    maxPendingReviews: 5,
    maxGateDepartures: 1,
    maxGateReturns: 3,
  },
  {
    name: "lunch",
    startMinute: 780,
    endMinute: 870,
    hostelToAcademicRatio: 0.018,
    hostelToLibraryRatio: 0.012,
    academicToHostelRatio: 0.06,
    libraryToHostelRatio: 0.06,
    buildingShiftRatio: 0.004,
    outpassRequestRatio: 0.01,
    pendingReviewRatio: 0.02,
    gateDepartureRatio: 0.003,
    gateReturnRatio: 0.015,
    maxHostelToAcademic: 5,
    maxHostelToLibrary: 4,
    maxAcademicToHostel: 16,
    maxLibraryToHostel: 8,
    maxBuildingShifts: 2,
    maxOutpassRequests: 3,
    maxPendingReviews: 5,
    maxGateDepartures: 2,
    maxGateReturns: 3,
  },
  {
    name: "afternoon_classes",
    startMinute: 870,
    endMinute: 1110,
    hostelToAcademicRatio: 0.05,
    hostelToLibraryRatio: 0.006,
    academicToHostelRatio: 0.024,
    libraryToHostelRatio: 0.022,
    buildingShiftRatio: 0.01,
    outpassRequestRatio: 0.2,
    pendingReviewRatio: 0.025,
    gateDepartureRatio: 0.005,
    gateReturnRatio: 0.02,
    maxHostelToAcademic: 16,
    maxHostelToLibrary: 3,
    maxAcademicToHostel: 10,
    maxLibraryToHostel: 5,
    maxBuildingShifts: 4,
    maxOutpassRequests: 5,
    maxPendingReviews: 6,
    maxGateDepartures: 6,
    maxGateReturns: 4,
  },
  {
    name: "evening",
    startMinute: 1110,
    endMinute: 1350,
    hostelToAcademicRatio: 0.009,
    hostelToLibraryRatio: 0.04,
    academicToHostelRatio: 0.05,
    libraryToHostelRatio: 0.065,
    buildingShiftRatio: 0.004,
    outpassRequestRatio: 0.015,
    pendingReviewRatio: 0.03,
    gateDepartureRatio: 0.02,
    gateReturnRatio: 0.022,
    maxHostelToAcademic: 7,
    maxHostelToLibrary: 15,
    maxAcademicToHostel: 12,
    maxLibraryToHostel: 12,
    maxBuildingShifts: 2,
    maxOutpassRequests: 8,
    maxPendingReviews: 8,
    maxGateDepartures: 7,
    maxGateReturns: 7,
  },
  {
    name: "late_night",
    startMinute: 1350,
    endMinute: 1440,
    hostelToAcademicRatio: 0,
    hostelToLibraryRatio: 0.003,
    academicToHostelRatio: 0.08,
    libraryToHostelRatio: 0.15,
    buildingShiftRatio: 0,
    outpassRequestRatio: 0.001,
    pendingReviewRatio: 0.01,
    gateDepartureRatio: 0,
    gateReturnRatio: 0.03,
    maxHostelToAcademic: 0,
    maxHostelToLibrary: 1,
    maxAcademicToHostel: 9,
    maxLibraryToHostel: 9,
    maxBuildingShifts: 0,
    maxOutpassRequests: 1,
    maxPendingReviews: 2,
    maxGateDepartures: 0,
    maxGateReturns: 7,
  },
]

let simulationInFlight = false
let closingSweepInFlight = false

const clamp = (value, minimum, maximum) =>
  Math.max(minimum, Math.min(value, maximum))

const randomInt = (minimum, maximum) => {
  if (maximum <= minimum) {
    return minimum
  }

  return minimum + Math.floor(Math.random() * (maximum - minimum + 1))
}

const toDate = (value) =>
  value instanceof Date ? new Date(value) : new Date(value || Date.now())

const chance = (probability) => Math.random() < probability

const shuffle = (items) => {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

const sampleItems = (items, count) => {
  if (count <= 0 || items.length === 0) {
    return []
  }

  return shuffle(items).slice(0, count)
}

const pickRandomItem = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  return items[Math.floor(Math.random() * items.length)]
}

const pickWeightedItem = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    return null
  }

  const totalWeight = items.reduce(
    (sum, item) => sum + Math.max(0, item.weight || 0),
    0,
  )
  if (totalWeight <= 0) {
    return items[0]
  }

  let threshold = Math.random() * totalWeight

  for (const item of items) {
    threshold -= Math.max(0, item.weight || 0)
    if (threshold <= 0) {
      return item
    }
  }

  return items[items.length - 1]
}

const getLocalMinutesOfDay = (value) => {
  return getLocalizedMinutes(value, CAMPUS_TIMEZONE)
}

const getLocalizedHour = (value) => Math.floor(getLocalMinutesOfDay(value) / 60)

const getWindowProfile = (value = new Date()) => {
  const minutes = getLocalMinutesOfDay(value)

  return (
    WINDOW_PROFILES.find((profile) =>
      profile.startMinute <= profile.endMinute
        ? minutes >= profile.startMinute && minutes < profile.endMinute
        : minutes >= profile.startMinute || minutes < profile.endMinute,
    ) || WINDOW_PROFILES[0]
  )
}

const buildCount = (totalStudents, ratio, cap, jitter = 1) =>
  clamp(Math.round(totalStudents * ratio) + randomInt(-jitter, jitter), 0, cap)

const pickAcademicDestination = (profile, now) => {
  const sacIsOpen = isSacOpenAt(now)
  const classWeights = [
    { value: "CC1", weight: 3 },
    { value: "CC2", weight: 3 },
    { value: "CC3", weight: 6 },
    { value: "AAA", weight: 2 },
    { value: "Lecture Theatre", weight: 2 },
    {
      value: "SAC",
      weight: sacIsOpen ? (profile.name === "lunch" ? 2 : 1) : 0,
    },
    {
      value: "Auditorium",
      weight:
        profile.name === "morning_classes" ||
        profile.name === "afternoon_classes"
          ? 1
          : 0.5,
    },
  ]

  if (profile.name === "evening" || profile.name === "late_night") {
    return pickRandomItem(
      sacIsOpen
        ? ACADEMIC_BUILDINGS
        : ACADEMIC_BUILDINGS.filter((location) => location !== "SAC"),
    )
  }

  return (
    pickWeightedItem(classWeights)?.value ||
    pickRandomItem(
      sacIsOpen
        ? ACADEMIC_BUILDINGS
        : ACADEMIC_BUILDINGS.filter((location) => location !== "SAC"),
    )
  )
}

const buildEmergencyContact = (student) => {
  const firstName =
    String(student.name || "Student")
      .trim()
      .split(/\s+/)[0] || "Student"
  const fallbackDigits =
    student.studentId?.replace(/\D/g, "").slice(-9) ||
    String(randomInt(100000000, 999999999))

  return {
    name: `${firstName} Guardian`,
    phone:
      student.phoneNumber || `9${fallbackDigits.padStart(9, "0").slice(-9)}`,
  }
}

const isMovementCoolingDown = (context, now, minutes) => {
  if (!context.latestMovement?.createdAt) {
    return false
  }

  return (
    now.getTime() - new Date(context.latestMovement.createdAt).getTime() <
    minutes * 60 * 1000
  )
}

const isOutpassCoolingDown = (context, now, minutes) => {
  if (!context.activeOutpass?.updatedAt && !context.activeOutpass?.createdAt) {
    return false
  }

  const anchor =
    context.activeOutpass.updatedAt || context.activeOutpass.createdAt
  return now.getTime() - new Date(anchor).getTime() < minutes * 60 * 1000
}

const getCurrentHostel = (context) =>
  context.student.hostel || context.state.hostel || HOSTELS[0]

const inferStudentState = (student, latestMovement) => {
  const fallbackHostel = student.hostel || HOSTELS[0]

  if (!latestMovement) {
    return {
      zone: "hostel",
      location: fallbackHostel,
      hostel: fallbackHostel,
    }
  }

  const location = String(latestMovement.location || "").trim()

  if (isExitGate(location)) {
    return latestMovement.action === "exit"
      ? {
          zone: "outside_campus",
          location,
          hostel: fallbackHostel,
        }
      : {
          zone: "hostel",
          location: fallbackHostel,
          hostel: fallbackHostel,
        }
  }

  if (HOSTELS.includes(location)) {
    return latestMovement.action === "entry"
      ? {
          zone: "hostel",
          location,
          hostel: location,
        }
      : {
          zone: "hostel",
          location: fallbackHostel,
          hostel: fallbackHostel,
        }
  }

  if (isCampusBuilding(location)) {
    if (latestMovement.action === "entry") {
      return {
        zone: location === LIBRARY_LOCATION ? "library" : "academic_building",
        location,
        hostel: fallbackHostel,
      }
    }

    return {
      zone: "hostel",
      location: fallbackHostel,
      hostel: fallbackHostel,
    }
  }

  return {
    zone: "hostel",
    location: fallbackHostel,
    hostel: fallbackHostel,
  }
}

const getMovementLogPayload = ({
  userId,
  guard,
  action,
  location,
  createdAt,
  details = {},
}) => ({
  id: generateId(),
  userId,
  action,
  location,
  guardId: guard.guardId || null,
  guardName: guard.name || null,
  success: true,
  details: {
    source: SIMULATION_SOURCE,
    legacySource: LEGACY_SIMULATION_SOURCE,
    mode: "cron",
    ...details,
  },
  scanType: MOVEMENT_SCAN_TYPE,
  createdAt,
})

const getSimulationTimestamp = (now, offsetSeconds = 0) => {
  const timestamp = new Date(now)
  timestamp.setSeconds(
    timestamp.getSeconds() + offsetSeconds,
    randomInt(0, 999),
  )
  return timestamp
}

const resolveGuardsByLocation = async () => {
  const guards = await prisma.user.findMany({
    where: {
      role: "security",
      isActive: true,
      securityProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      name: true,
      guardId: true,
      securityProfile: {
        select: {
          guardId: true,
          securityPost: true,
        },
      },
    },
  })

  const guardMap = new Map()

  for (const guard of guards) {
    const location = guard.securityProfile?.securityPost || null
    if (!location) {
      continue
    }

    if (!guardMap.has(location)) {
      guardMap.set(location, [])
    }

    guardMap.get(location).push({
      id: guard.id,
      name: guard.name,
      guardId: guard.securityProfile?.guardId || guard.guardId || null,
      location,
    })
  }

  return guardMap
}

const resolveWardensByHostel = async () => {
  const wardens = await prisma.user.findMany({
    where: {
      role: "warden",
      isActive: true,
      wardenProfile: {
        isNot: null,
      },
    },
    select: {
      id: true,
      name: true,
      hostel: true,
      wardenProfile: {
        select: {
          hostel: true,
        },
      },
    },
  })

  return new Map(
    wardens
      .map((warden) => ({
        id: warden.id,
        name: warden.name,
        hostel: warden.wardenProfile?.hostel || warden.hostel || null,
      }))
      .filter((warden) => warden.hostel)
      .map((warden) => [warden.hostel, warden]),
  )
}

const getActiveStudents = async () =>
  prisma.user.findMany({
    where: {
      role: "student",
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      studentId: true,
      hostel: true,
      roomNumber: true,
      phoneNumber: true,
      emergencyContact: true,
    },
  })

const isTrackableOutpass = (outpass) => {
  if (!outpass) {
    return false
  }

  if (outpass.status === "pending") {
    return true
  }

  if (
    ["approved", "expired"].includes(outpass.status) &&
    !outpass.actualReturnDate
  ) {
    return true
  }

  return false
}

const getLatestRelevantOutpassMap = async (studentIds) => {
  if (studentIds.length === 0) {
    return new Map()
  }

  const outpasses = await prisma.outpass.findMany({
    where: {
      userId: {
        in: studentIds,
      },
    },
    orderBy: [{ createdAt: "desc" }, { outDate: "desc" }],
  })

  const outpassMap = new Map()

  for (const outpass of outpasses) {
    if (!outpassMap.has(outpass.userId) && isTrackableOutpass(outpass)) {
      outpassMap.set(outpass.userId, outpass)
    }
  }

  return outpassMap
}

const getActiveLibrarySeatMap = async (studentIds = []) => {
  const where = {
    leftAt: null,
    ...(studentIds.length
      ? {
          userId: {
            in: studentIds,
          },
        }
      : {}),
  }

  const sessions = await prisma.librarySeatSession.findMany({
    where,
    orderBy: [{ enteredAt: "desc" }, { id: "desc" }],
  })

  const seatMap = new Map()
  for (const session of sessions) {
    if (!seatMap.has(session.userId)) {
      seatMap.set(session.userId, session)
    }
  }
  return seatMap
}

const createStudentContextMap = ({
  students,
  movementMap,
  gateMovementMap,
  outpassMap,
  librarySeatMap,
}) =>
  new Map(
    students.map((student) => {
      const latestMovement = movementMap.get(student.id) || null
      const latestGateMovement = gateMovementMap.get(student.id) || null
      const activeOutpass = outpassMap.get(student.id) || null
      const activeLibrarySeat = librarySeatMap.get(student.id) || null

      return [
        student.id,
        {
          student,
          latestMovement,
          latestGateMovement,
          activeOutpass,
          activeLibrarySeat,
          state: inferStudentState(student, latestMovement),
        },
      ]
    }),
  )

const getEligibleContexts = ({ contextMap, reservedIds, predicate }) =>
  [...contextMap.values()].filter(
    (context) => !reservedIds.has(context.student.id) && predicate(context),
  )

const reserveContexts = (reservedIds, contexts = []) => {
  for (const context of contexts) {
    reservedIds.add(context.student.id)
  }
}

const pickGuardForLocation = (guardMap, location) =>
  pickRandomItem(guardMap.get(location) || [])

const syncMovementState = (context, movement) => {
  context.latestMovement = movement

  if (movement && isExitGate(movement.location)) {
    context.latestGateMovement = movement
  }

  context.state = inferStudentState(context.student, movement)
}

const syncOutpassState = (context, outpass) => {
  context.activeOutpass = outpass
}

const syncLibrarySeatState = (context, seatSession) => {
  context.activeLibrarySeat = seatSession || null
}

const getOccupiedLibrarySeatNumbers = (contextMap) =>
  new Set(
    [...contextMap.values()]
      .map((context) => context.activeLibrarySeat?.seatNumber)
      .filter((seatNumber) => Number.isInteger(seatNumber)),
  )

const pickAvailableLibrarySeatNumber = (contextMap) => {
  const occupied = getOccupiedLibrarySeatNumbers(contextMap)
  const limit = getLibraryLimit()
  const available = []

  for (let seatNumber = 1; seatNumber <= limit; seatNumber += 1) {
    if (!occupied.has(seatNumber)) {
      available.push(seatNumber)
    }
  }

  return pickRandomItem(available)
}

const createInternalMovement = async ({
  context,
  contextMap,
  fromLocation,
  toLocation,
  now,
  guardMap,
  transition,
}) => {
  const exitGuard = pickGuardForLocation(guardMap, fromLocation)
  const entryGuard = pickGuardForLocation(guardMap, toLocation)

  if (!exitGuard || !entryGuard) {
    return false
  }

  const enteringLibrary = toLocation === LIBRARY_LOCATION
  const leavingLibrary = fromLocation === LIBRARY_LOCATION
  const nextLibrarySeat = enteringLibrary
    ? pickAvailableLibrarySeatNumber(contextMap)
    : null

  if (enteringLibrary && !isLibOpenAt(now)) {
    return false
  }

  if (enteringLibrary && !nextLibrarySeat) {
    return false
  }

  const exitAt = getSimulationTimestamp(now, -randomInt(20, 90))
  const entryAt = getSimulationTimestamp(now, -randomInt(0, 10))

  const exitLog = getMovementLogPayload({
    userId: context.student.id,
    guard: exitGuard,
    action: "exit",
    location: fromLocation,
    createdAt: exitAt,
    details: {
      transition,
      targetLocation: toLocation,
    },
  })

  const entryLog = getMovementLogPayload({
    userId: context.student.id,
    guard: entryGuard,
    action: "entry",
    location: toLocation,
    createdAt: entryAt,
    details: {
      transition,
      fromLocation,
    },
  })

  const activeLibrarySeat = leavingLibrary
    ? context.activeLibrarySeat ||
      (await getActiveSeatSession(prisma, context.student.id))
    : null

  await prisma.$transaction(async (tx) => {
    if (fromLocation === "SAC") {
      await cleanupSacStateForStudent({
        client: tx,
        userId: context.student.id,
        now: exitAt,
        reason: transition,
      })
    }

    await tx.log.createMany({
      data: [exitLog, entryLog],
    })

    if (leavingLibrary && activeLibrarySeat) {
      await releaseLibrarySeat(tx, {
        session: activeLibrarySeat,
        timestamp: exitAt,
        createMovement: false,
        details: {
          source: SIMULATION_SOURCE,
          transition,
          targetLocation: toLocation,
          simulated: true,
        },
      })
    }

    if (enteringLibrary) {
      await claimLibrarySeat(tx, {
        userId: context.student.id,
        seatNumber: nextLibrarySeat,
        timestamp: entryAt,
        createMovement: false,
        details: {
          source: SIMULATION_SOURCE,
          transition,
          fromLocation,
          simulated: true,
        },
      })
    }
  })

  syncMovementState(context, {
    id: entryLog.id,
    action: entryLog.action,
    location: entryLog.location,
    guardId: entryLog.guardId,
    guardName: entryLog.guardName,
    createdAt: entryLog.createdAt,
  })

  if (leavingLibrary) {
    syncLibrarySeatState(context, null)
  }

  if (enteringLibrary) {
    syncLibrarySeatState(context, {
      id: generateId(),
      userId: context.student.id,
      seatNumber: nextLibrarySeat,
      enteredAt: entryAt,
      leftAt: null,
      lastActivityAt: entryAt,
    })
  }

  return true
}

const createSacSimulationLog = async (
  client,
  { userId, action, description, now, details = {} },
) =>
  client.log.create({
    data: {
      id: generateId(),
      userId,
      action,
      location: "SAC",
      success: true,
      details: {
        source: SIMULATION_SOURCE,
        legacySource: LEGACY_SIMULATION_SOURCE,
        simulated: true,
        description,
        ...details,
      },
      scanType: MOVEMENT_SCAN_TYPE,
      createdAt: now,
    },
  })

const cleanupSacStateForStudent = async ({ client, userId, now, reason }) => {
  const [activePresences, activeCheckouts] = await Promise.all([
    client.sacRoomPresence.findMany({
      where: {
        userId,
        leftAt: null,
        session: {
          closedAt: null,
        },
      },
      include: {
        session: true,
      },
    }),
    client.sacEquipmentCheckout.findMany({
      where: {
        userId,
        returnedAt: null,
      },
    }),
  ])

  for (const presence of activePresences) {
    await client.sacRoomPresence.update({
      where: {
        id: presence.id,
      },
      data: {
        leftAt: now,
      },
    })

    const remainingOccupants = await client.sacRoomPresence.count({
      where: {
        sessionId: presence.sessionId,
        leftAt: null,
      },
    })

    await client.sacRoomSession.update({
      where: {
        id: presence.sessionId,
      },
      data:
        remainingOccupants === 0
          ? { closedAt: now, lastActivityAt: now }
          : { lastActivityAt: now },
    })

    await createSacSimulationLog(client, {
      userId,
      action: "sac_room_left",
      description: `Left ${presence.session.roomName} room`,
      now,
      details: {
        roomName: presence.session.roomName,
        reason,
      },
    })
  }

  for (const checkout of activeCheckouts) {
    await client.sacEquipmentCheckout.update({
      where: {
        id: checkout.id,
      },
      data: {
        returnedAt: now,
      },
    })

    await createSacSimulationLog(client, {
      userId,
      action: "sac_equipment_returned",
      description: `Returned ${checkout.equipmentName}`,
      now,
      details: {
        equipmentName: checkout.equipmentName,
        reason,
      },
    })
  }

  return activePresences.length + activeCheckouts.length
}

const simulateSacRoomActivity = async ({
  contextMap,
  reservedIds,
  now,
  counters,
}) => {
  if (!isSacOpenAt(now)) {
    return
  }

  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.location === "SAC" &&
      !isMovementCoolingDown(context, now, 15),
  })

  const selected = sampleItems(
    eligible,
    Math.min(eligible.length, buildCount(contextMap.size, 0.015, 4, 1)),
  )

  for (const context of selected) {
    const activePresence = await prisma.sacRoomPresence.findFirst({
      where: {
        userId: context.student.id,
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

    if (activePresence) {
      continue
    }

    const roomName = pickRandomItem(SAC_CLUB_ROOMS)
    const existingSession = await prisma.sacRoomSession.findFirst({
      where: {
        roomName,
        closedAt: null,
      },
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    })
    const actionAt = getSimulationTimestamp(now, -randomInt(1, 30))

    await prisma.$transaction(async (tx) => {
      if (!existingSession) {
        const sessionId = generateId()

        await tx.sacRoomSession.create({
          data: {
            id: sessionId,
            roomName,
            openedByUserId: context.student.id,
            openedAt: actionAt,
            lastActivityAt: actionAt,
          },
        })

        await tx.sacRoomPresence.create({
          data: {
            id: generateId(),
            sessionId,
            userId: context.student.id,
            joinedAt: actionAt,
          },
        })

        await createSacSimulationLog(tx, {
          userId: context.student.id,
          action: "sac_room_opened",
          description: `Opened ${roomName} room`,
          now: actionAt,
          details: {
            roomName,
          },
        })
      } else {
        await tx.sacRoomPresence.create({
          data: {
            id: generateId(),
            sessionId: existingSession.id,
            userId: context.student.id,
            joinedAt: actionAt,
          },
        })

        await tx.sacRoomSession.update({
          where: {
            id: existingSession.id,
          },
          data: {
            lastActivityAt: actionAt,
          },
        })

        await createSacSimulationLog(tx, {
          userId: context.student.id,
          action: "sac_room_joined",
          description: `Joined ${roomName} room`,
          now: actionAt,
          details: {
            roomName,
          },
        })
      }
    })

    counters.sacRoomActions += 1
  }

  reserveContexts(reservedIds, selected)
}

const simulateSacEquipmentActivity = async ({
  contextMap,
  reservedIds,
  now,
  counters,
}) => {
  if (!isSacOpenAt(now)) {
    return
  }

  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.location === "SAC" &&
      !isMovementCoolingDown(context, now, 15),
  })

  const selected = sampleItems(
    eligible,
    Math.min(eligible.length, buildCount(contextMap.size, 0.018, 5, 1)),
  )

  for (const context of selected) {
    const activeCheckout = await prisma.sacEquipmentCheckout.findFirst({
      where: {
        userId: context.student.id,
        returnedAt: null,
      },
      orderBy: [{ checkedOutAt: "desc" }, { id: "desc" }],
    })
    const actionAt = getSimulationTimestamp(now, -randomInt(1, 20))

    await prisma.$transaction(async (tx) => {
      if (activeCheckout && chance(0.45)) {
        await tx.sacEquipmentCheckout.update({
          where: {
            id: activeCheckout.id,
          },
          data: {
            returnedAt: actionAt,
          },
        })

        await createSacSimulationLog(tx, {
          userId: context.student.id,
          action: "sac_equipment_returned",
          description: `Returned ${activeCheckout.equipmentName}`,
          now: actionAt,
          details: {
            equipmentName: activeCheckout.equipmentName,
          },
        })
      } else {
        const equipmentName = pickRandomItem(SAC_EQUIPMENT)

        await tx.sacEquipmentCheckout.create({
          data: {
            id: generateId(),
            equipmentName,
            userId: context.student.id,
            checkedOutAt: actionAt,
          },
        })

        await createSacSimulationLog(tx, {
          userId: context.student.id,
          action: "sac_equipment_taken",
          description: `Took ${equipmentName}`,
          now: actionAt,
          details: {
            equipmentName,
          },
        })
      }
    })

    counters.sacEquipmentActions += 1
  }

  reserveContexts(reservedIds, selected)
}

const closeActiveSacState = async ({
  now,
  counters,
  reason = "sac_closed",
}) => {
  const [activePresences, activeCheckouts] = await Promise.all([
    prisma.sacRoomPresence.findMany({
      where: {
        leftAt: null,
        session: {
          closedAt: null,
        },
      },
      include: {
        session: true,
      },
    }),
    prisma.sacEquipmentCheckout.findMany({
      where: {
        returnedAt: null,
      },
    }),
  ])

  const affectedUserIds = [
    ...new Set([
      ...activePresences.map((presence) => presence.userId),
      ...activeCheckouts.map((checkout) => checkout.userId),
    ]),
  ]

  for (const userId of affectedUserIds) {
    const actionAt = getSimulationTimestamp(now, -randomInt(0, 10))
    await cleanupSacStateForStudent({
      client: prisma,
      userId,
      now: actionAt,
      reason,
    })
  }

  if (counters) {
    counters.sacClosures += activePresences.length + activeCheckouts.length
  }
}

const buildRegularOutpassWindow = (now) => {
  const localHour = getLocalizedHour(now)
  const baseExit = new Date(now)
  const baseReturn = new Date(now)

  if (localHour < 15) {
    baseExit.setHours(17, randomInt(0, 35), 0, 0)
    baseReturn.setHours(randomInt(19, 21), randomInt(0, 55), 0, 0)
  } else if (localHour < 18) {
    baseExit.setMinutes(baseExit.getMinutes() + randomInt(20, 90))
    baseReturn.setTime(baseExit.getTime() + randomInt(120, 240) * 60 * 1000)
  } else if (localHour < 21) {
    baseExit.setMinutes(baseExit.getMinutes() + randomInt(5, 35))
    baseReturn.setTime(baseExit.getTime() + randomInt(60, 150) * 60 * 1000)
  } else {
    baseExit.setDate(baseExit.getDate() + 1)
    baseReturn.setDate(baseReturn.getDate() + 1)
    baseExit.setHours(17, randomInt(0, 25), 0, 0)
    baseReturn.setHours(randomInt(19, 21), randomInt(0, 50), 0, 0)
  }

  const cutoff = getCutoffTimeForDate(
    baseExit,
    RETURN_CUTOFF_HOUR,
    RETURN_CUTOFF_MINUTE,
  )
  if (baseReturn > cutoff) {
    baseReturn.setTime(cutoff.getTime() - randomInt(5, 25) * 60 * 1000)
  }

  if (baseReturn <= baseExit) {
    const fallbackReturn = new Date(baseExit.getTime() + 90 * 60 * 1000)
    const latestAllowedReturn = new Date(cutoff.getTime() - 5 * 60 * 1000)

    if (fallbackReturn > latestAllowedReturn) {
      fallbackReturn.setTime(latestAllowedReturn.getTime())
    }

    baseReturn.setTime(
      Math.max(fallbackReturn.getTime(), baseExit.getTime() + 20 * 60 * 1000),
    )
  }

  return {
    exitDate: baseExit,
    returnDate: baseReturn,
  }
}

const buildLongVisitWindow = (now) => {
  const exitDate = new Date(now)
  exitDate.setMinutes(exitDate.getMinutes() + randomInt(60, 240))

  const returnDate = new Date(exitDate)
  returnDate.setDate(returnDate.getDate() + randomInt(1, 3))
  returnDate.setHours(randomInt(9, 18), randomInt(0, 50), 0, 0)

  return {
    exitDate,
    returnDate,
  }
}

const createOutpassRequest = async ({ context, requestType, now }) => {
  const template =
    requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
      ? pickRandomItem(LONG_VISIT_DESTINATIONS)
      : pickRandomItem(REGULAR_OUTPASS_DESTINATIONS)
  const window =
    requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
      ? buildLongVisitWindow(now)
      : buildRegularOutpassWindow(now)
  const emergencyContact = buildEmergencyContact(context.student)
  const createdAt = getSimulationTimestamp(now, -randomInt(10, 120))
  const remarks =
    requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
      ? "Long visit request submitted. Physical warden approval required."
      : "Outpass request submitted"
  const logAction =
    requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT
      ? "outpass_long_visit"
      : "outpass_request"

  const outpass = await prisma.$transaction(async (tx) => {
    const createdOutpass = await tx.outpass.create({
      data: {
        id: generateId(),
        userId: context.student.id,
        reason: template.reason,
        destination: template.destination,
        outDate: window.exitDate,
        expectedReturnDate: window.returnDate,
        requestType,
        status: "pending",
        emergencyContactName: emergencyContact.name,
        emergencyContactPhone: emergencyContact.phone,
        createdAt,
        updatedAt: createdAt,
      },
    })

    await tx.outpassAuditTrail.create({
      data: {
        id: generateId(),
        outpassId: createdOutpass.id,
        status: "pending",
        changedBy: context.student.id,
        changedAt: createdAt,
        remarks,
      },
    })

    await tx.log.create({
      data: {
        id: generateId(),
        userId: context.student.id,
        action: logAction,
        success: true,
        details: {
          source: SIMULATION_SOURCE,
          legacySource: LEGACY_SIMULATION_SOURCE,
          outpassId: createdOutpass.id,
          requestType,
          requestedExit: window.exitDate.toISOString(),
          requestedReturn: window.returnDate.toISOString(),
          message: `${template.reason} for ${template.destination}`,
        },
        scanType: MOVEMENT_SCAN_TYPE,
        createdAt,
      },
    })

    return createdOutpass
  })

  syncOutpassState(context, outpass)
  return outpass
}

const transitionOutpassStatus = async ({
  context,
  outpass,
  nextStatus,
  changedBy,
  source,
  remarks,
  rejectionReason = null,
  now,
}) => {
  const changedAt = getSimulationTimestamp(now, -randomInt(5, 90))

  const updatedOutpass = await prisma.$transaction(async (tx) => {
    const updated = await tx.outpass.update({
      where: {
        id: outpass.id,
      },
      data: {
        status: nextStatus,
        rejectionReason:
          nextStatus === "rejected"
            ? rejectionReason || "Not approved by hostel warden"
            : null,
        approvedById:
          nextStatus === "approved" ? changedBy : outpass.approvedById,
        updatedAt: changedAt,
      },
    })

    await tx.outpassAuditTrail.create({
      data: {
        id: generateId(),
        outpassId: outpass.id,
        status: nextStatus,
        changedBy,
        changedAt,
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
          source,
          simulated: true,
          outpassId: outpass.id,
          requestType: outpass.requestType,
          previousStatus: outpass.status,
          nextStatus,
        },
        scanType: MOVEMENT_SCAN_TYPE,
        createdAt: changedAt,
      },
    })

    return updated
  })

  syncOutpassState(context, updatedOutpass)
  return updatedOutpass
}

const createOutpassBackedGateExit = async ({
  context,
  outpass,
  now,
  guardMap,
}) => {
  const gate = pickRandomItem(EXIT_GATES)
  const guard = pickGuardForLocation(guardMap, gate)
  const wasInLibrary = context.state.zone === "library"

  if (!guard) {
    return false
  }

  const exitAt = getSimulationTimestamp(now, -randomInt(5, 80))

  const exitLog = getMovementLogPayload({
    userId: context.student.id,
    guard,
    action: "exit",
    location: gate,
    createdAt: exitAt,
    details: {
      outpassId: outpass.id,
      requestType: outpass.requestType,
      transition: "campus_to_outside",
    },
  })

  await prisma.$transaction(async (tx) => {
    if (context.state.location === "SAC") {
      await cleanupSacStateForStudent({
        client: tx,
        userId: context.student.id,
        now: exitAt,
        reason: "campus_to_outside",
      })
    }

    if (wasInLibrary) {
      const activeSeat =
        context.activeLibrarySeat ||
        (await getActiveSeatSession(tx, context.student.id))
      if (activeSeat) {
        await releaseLibrarySeat(tx, {
          session: activeSeat,
          timestamp: exitAt,
          createMovement: false,
          details: {
            source: SIMULATION_SOURCE,
            transition: "library_to_outside",
            simulated: true,
          },
        })
      }
    }

    await tx.log.create({
      data: exitLog,
    })

    await tx.outpassAuditTrail.create({
      data: {
        id: generateId(),
        outpassId: outpass.id,
        status: outpass.status,
        changedBy: context.student.id,
        changedAt: exitAt,
        remarks: "Student exited campus using approved outpass",
      },
    })

    await tx.log.create({
      data: {
        id: generateId(),
        userId: context.student.id,
        action: "outpass_used",
        location: gate,
        guardId: guard.guardId || null,
        guardName: guard.name || null,
        success: true,
        details: {
          source: SIMULATION_SOURCE,
          legacySource: LEGACY_SIMULATION_SOURCE,
          direction: "exit",
          outpassId: outpass.id,
          requestType: outpass.requestType,
        },
        scanType: MOVEMENT_SCAN_TYPE,
        createdAt: getSimulationTimestamp(exitAt, randomInt(1, 8)),
      },
    })

    await tx.outpass.update({
      where: {
        id: outpass.id,
      },
      data: {
        updatedAt: exitAt,
      },
    })
  })

  syncMovementState(context, {
    id: exitLog.id,
    action: exitLog.action,
    location: exitLog.location,
    guardId: exitLog.guardId,
    guardName: exitLog.guardName,
    createdAt: exitLog.createdAt,
  })
  if (wasInLibrary) {
    syncLibrarySeatState(context, null)
  }
  syncOutpassState(context, {
    ...outpass,
    updatedAt: exitAt,
  })

  return true
}

const createOutpassBackedGateReturn = async ({
  context,
  outpass,
  now,
  guardMap,
}) => {
  const gate = pickRandomItem(EXIT_GATES)
  const guard = pickGuardForLocation(guardMap, gate)

  if (!guard) {
    return false
  }

  const entryAt = getSimulationTimestamp(now, -randomInt(5, 80))

  const entryLog = getMovementLogPayload({
    userId: context.student.id,
    guard,
    action: "entry",
    location: gate,
    createdAt: entryAt,
    details: {
      outpassId: outpass.id,
      requestType: outpass.requestType,
      transition: "outside_to_campus",
    },
  })

  const updatedOutpass = await prisma.$transaction(async (tx) => {
    await tx.log.create({
      data: entryLog,
    })

    const refreshedOutpass = await tx.outpass.update({
      where: {
        id: outpass.id,
      },
      data: {
        actualReturnDate: entryAt,
        updatedAt: entryAt,
      },
    })

    await tx.outpassAuditTrail.create({
      data: {
        id: generateId(),
        outpassId: outpass.id,
        status: outpass.status,
        changedBy: context.student.id,
        changedAt: entryAt,
        remarks:
          outpass.status === "expired"
            ? "Student returned to campus after the outpass window had expired"
            : "Student returned to campus using outpass",
      },
    })

    await tx.log.create({
      data: {
        id: generateId(),
        userId: context.student.id,
        action: "outpass_used",
        location: gate,
        guardId: guard.guardId || null,
        guardName: guard.name || null,
        success: true,
        details: {
          source: SIMULATION_SOURCE,
          legacySource: LEGACY_SIMULATION_SOURCE,
          direction: "entry",
          outpassId: outpass.id,
          requestType: outpass.requestType,
        },
        scanType: MOVEMENT_SCAN_TYPE,
        createdAt: getSimulationTimestamp(entryAt, randomInt(1, 8)),
      },
    })

    return refreshedOutpass
  })

  syncMovementState(context, {
    id: entryLog.id,
    action: entryLog.action,
    location: entryLog.location,
    guardId: entryLog.guardId,
    guardName: entryLog.guardName,
    createdAt: entryLog.createdAt,
  })
  syncOutpassState(context, updatedOutpass)

  return true
}

const simulateOutpassRequests = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      ["hostel", "academic_building", "library"].includes(context.state.zone) &&
      !context.activeOutpass &&
      !isMovementCoolingDown(context, now, 20),
  })

  const requestCount = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.outpassRequestRatio,
      profile.maxOutpassRequests,
      2,
    ),
  )
  const selected = sampleItems(eligible, requestCount)

  for (const context of selected) {
    const requestType = chance(profile.name === "evening" ? 0.08 : 0.03)
      ? OUTPASS_REQUEST_TYPE.LONG_VISIT
      : OUTPASS_REQUEST_TYPE.REGULAR
    await createOutpassRequest({
      context,
      requestType,
      now,
    })

    counters.outpassRequests += 1
    if (requestType === OUTPASS_REQUEST_TYPE.LONG_VISIT) {
      counters.longVisitRequests += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateWardenReviews = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  wardenMap,
  counters,
}) => {
  const pendingContexts = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.activeOutpass?.status === "pending" &&
      !isOutpassCoolingDown(context, now, 5) &&
      Boolean(wardenMap.get(getCurrentHostel(context))),
  })

  const reviewCount = Math.min(
    pendingContexts.length,
    buildCount(
      contextMap.size,
      profile.pendingReviewRatio,
      profile.maxPendingReviews,
      2,
    ),
  )
  const selected = sampleItems(pendingContexts, reviewCount)

  for (const context of selected) {
    const outpass = context.activeOutpass
    const warden = wardenMap.get(getCurrentHostel(context))
    if (!warden || !outpass) {
      continue
    }

    let nextStatus = "approved"
    let remarks = "Approved by hostel warden"
    let rejectionReason = null

    if (chance(0.025)) {
      nextStatus = "rejected"
      remarks = "Rejected by hostel warden"
      rejectionReason = "Simulation created a low-probability rejection"
    }

    await transitionOutpassStatus({
      context,
      outpass,
      nextStatus,
      changedBy: warden.id,
      source: "warden",
      remarks,
      rejectionReason,
      now,
    })

    counters.outpassReviews += 1
    if (nextStatus === "approved") {
      counters.outpassApproved += 1
    } else {
      counters.outpassRejected += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateRareCancellations = async ({
  contextMap,
  reservedIds,
  now,
  counters,
  wardenMap,
}) => {
  const cancellableContexts = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.activeOutpass &&
      ["pending", "approved"].includes(context.activeOutpass.status) &&
      canCancelOutpass(context.activeOutpass, context.latestMovement, now) &&
      !isOutpassCoolingDown(context, now, 10),
  })

  const selected = cancellableContexts.filter((context) =>
    chance(context.activeOutpass.status === "pending" ? 0.01 : 0.006),
  )

  for (const context of selected) {
    const source = chance(0.6) ? "student" : "warden"
    const warden = wardenMap.get(getCurrentHostel(context)) || null
    const changedBy =
      source === "student"
        ? context.student.id
        : warden?.id || context.student.id
    const remarks =
      source === "student"
        ? "Cancelled by student"
        : "Cancelled by hostel warden"

    await transitionOutpassStatus({
      context,
      outpass: context.activeOutpass,
      nextStatus: "cancelled",
      changedBy,
      source,
      remarks,
      now,
    })

    counters.outpassCancelled += 1
  }

  reserveContexts(reservedIds, selected)
}

const simulateGateDepartures = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      ["hostel", "academic_building", "library"].includes(context.state.zone) &&
      context.activeOutpass?.requestType === OUTPASS_REQUEST_TYPE.REGULAR &&
      context.activeOutpass?.status === "approved" &&
      !context.activeOutpass.actualReturnDate &&
      canUseOutpass(context.activeOutpass, context.latestMovement, now) &&
      !isMovementCoolingDown(context, now, 15),
  })

  const departureCount = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.gateDepartureRatio,
      profile.maxGateDepartures,
      2,
    ),
  )
  const selected = sampleItems(eligible, departureCount)

  for (const context of selected) {
    const created = await createOutpassBackedGateExit({
      context,
      outpass: context.activeOutpass,
      now,
      guardMap,
    })

    if (created) {
      counters.gateDepartures += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateGateReturns = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.zone === "outside_campus" &&
      context.activeOutpass?.requestType === OUTPASS_REQUEST_TYPE.REGULAR &&
      ["approved", "expired"].includes(context.activeOutpass.status) &&
      !context.activeOutpass.actualReturnDate,
  })

  const selected = eligible.filter((context) => {
    const dueSoon =
      context.activeOutpass.expectedReturnDate &&
      new Date(context.activeOutpass.expectedReturnDate).getTime() -
        now.getTime() <=
        45 * 60 * 1000

    return chance(dueSoon ? 0.75 : 0.28)
  })
  const limited = sampleItems(
    selected,
    Math.min(selected.length, profile.maxGateReturns),
  )

  for (const context of limited) {
    const returned = await createOutpassBackedGateReturn({
      context,
      outpass: context.activeOutpass,
      now,
      guardMap,
    })

    if (returned) {
      counters.gateReturns += 1
    }
  }

  reserveContexts(reservedIds, limited)
}

const simulateHostelToAcademic = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.zone === "hostel" &&
      !isMovementCoolingDown(context, now, 20),
  })
  const count = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.hostelToAcademicRatio,
      profile.maxHostelToAcademic,
      2,
    ),
  )
  const selected = sampleItems(eligible, count)

  for (const context of selected) {
    const moved = await createInternalMovement({
      context,
      contextMap,
      fromLocation: getCurrentHostel(context),
      toLocation: pickAcademicDestination(profile, now),
      now,
      guardMap,
      transition: "hostel_to_academic",
    })

    if (moved) {
      counters.internalMoves += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateHostelToLibrary = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  if (!isLibOpenAt(now)) {
    return
  }

  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.zone === "hostel" &&
      !isMovementCoolingDown(context, now, 20),
  })
  const count = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.hostelToLibraryRatio,
      profile.maxHostelToLibrary,
      1,
    ),
  )
  const selected = sampleItems(eligible, count)

  for (const context of selected) {
    const moved = await createInternalMovement({
      context,
      contextMap,
      fromLocation: getCurrentHostel(context),
      toLocation: LIBRARY_LOCATION,
      now,
      guardMap,
      transition: "hostel_to_library",
    })

    if (moved) {
      counters.internalMoves += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateAcademicToHostel = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.zone === "academic_building" &&
      !isMovementCoolingDown(context, now, 15),
  })
  const count = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.academicToHostelRatio,
      profile.maxAcademicToHostel,
      2,
    ),
  )
  const selected = sampleItems(eligible, count)

  for (const context of selected) {
    const moved = await createInternalMovement({
      context,
      contextMap,
      fromLocation: context.state.location,
      toLocation: getCurrentHostel(context),
      now,
      guardMap,
      transition: "academic_to_hostel",
    })

    if (moved) {
      counters.internalMoves += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateLibraryToHostel = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      context.state.zone === "library" &&
      !isMovementCoolingDown(context, now, 15),
  })
  const count = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.libraryToHostelRatio,
      profile.maxLibraryToHostel,
      2,
    ),
  )
  const selected = sampleItems(eligible, count)

  for (const context of selected) {
    const moved = await createInternalMovement({
      context,
      contextMap,
      fromLocation: LIBRARY_LOCATION,
      toLocation: getCurrentHostel(context),
      now,
      guardMap,
      transition: "library_to_hostel",
    })

    if (moved) {
      counters.internalMoves += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const simulateBuildingShifts = async ({
  contextMap,
  reservedIds,
  profile,
  now,
  guardMap,
  counters,
}) => {
  const eligible = getEligibleContexts({
    contextMap,
    reservedIds,
    predicate: (context) =>
      ["academic_building", "library"].includes(context.state.zone) &&
      !isMovementCoolingDown(context, now, 15),
  })
  const count = Math.min(
    eligible.length,
    buildCount(
      contextMap.size,
      profile.buildingShiftRatio,
      profile.maxBuildingShifts,
      1,
    ),
  )
  const selected = sampleItems(eligible, count)

  for (const context of selected) {
    const fromLocation = context.state.location
    const sacIsOpen = isSacOpenAt(now)
    const libIsOpen = isLibOpenAt(now)
    const academicTargets = sacIsOpen
      ? ACADEMIC_BUILDINGS
      : ACADEMIC_BUILDINGS.filter((location) => location !== "SAC")
    const destinationOptions =
      fromLocation === LIBRARY_LOCATION
        ? academicTargets
        : [
            ...(libIsOpen ? [LIBRARY_LOCATION] : []),
            ...academicTargets.filter((location) => location !== fromLocation),
          ]
    const toLocation = pickRandomItem(destinationOptions)

    const moved = await createInternalMovement({
      context,
      contextMap,
      fromLocation,
      toLocation,
      now,
      guardMap,
      transition: "building_shift",
    })

    if (moved) {
      counters.internalMoves += 1
    }
  }

  reserveContexts(reservedIds, selected)
}

const buildCounters = () => ({
  internalMoves: 0,
  outpassRequests: 0,
  longVisitRequests: 0,
  outpassReviews: 0,
  outpassApproved: 0,
  outpassRejected: 0,
  outpassCancelled: 0,
  gateDepartures: 0,
  gateReturns: 0,
  expiredOutpasses: 0,
  sacRoomActions: 0,
  sacEquipmentActions: 0,
  sacClosures: 0,
})

const runCampusActivitySimulation = async (now = new Date()) => {
  if (simulationInFlight) {
    return {
      skipped: true,
      reason: "simulation_already_running",
    }
  }

  simulationInFlight = true

  try {
    const simulationTime = toDate(now)
    const profile = getWindowProfile(simulationTime)

    const expiredOutpasses = await expireOldOutpasses(prisma)

    const [students, guardMap, wardenMap] = await Promise.all([
      getActiveStudents(),
      resolveGuardsByLocation(),
      resolveWardensByHostel(),
    ])

    if (students.length === 0) {
      return {
        skipped: true,
        reason: "no_active_students",
      }
    }

    const studentIds = students.map((student) => student.id)
    const [movementMap, gateMovementMap, outpassMap, librarySeatMap] =
      await Promise.all([
        getLatestMovementMap(prisma, studentIds),
        getLatestGateMovementMap(prisma, studentIds),
        getLatestRelevantOutpassMap(studentIds),
        getActiveLibrarySeatMap(studentIds),
      ])

    const contextMap = createStudentContextMap({
      students,
      movementMap,
      gateMovementMap,
      outpassMap,
      librarySeatMap,
    })
    const reservedIds = new Set()
    const counters = buildCounters()
    counters.expiredOutpasses = expiredOutpasses

    await simulateGateReturns({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    reservedIds.clear()

    if (isSacOpenAt(simulationTime)) {
      await simulateSacRoomActivity({
        contextMap,
        reservedIds,
        now: simulationTime,
        counters,
      })
      reservedIds.clear()

      await simulateSacEquipmentActivity({
        contextMap,
        reservedIds,
        now: simulationTime,
        counters,
      })
      reservedIds.clear()
    } else {
      await closeActiveSacState({
        now: simulationTime,
        counters,
        reason: "sac_closed_at_1030_pm",
      })
    }

    await simulateOutpassRequests({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      counters,
    })
    reservedIds.clear()

    await simulateWardenReviews({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      wardenMap,
      counters,
    })
    reservedIds.clear()

    await simulateRareCancellations({
      contextMap,
      reservedIds,
      now: simulationTime,
      counters,
      wardenMap,
    })
    reservedIds.clear()

    await simulateGateDepartures({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    reservedIds.clear()

    await simulateAcademicToHostel({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    await simulateLibraryToHostel({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    await simulateHostelToAcademic({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    await simulateHostelToLibrary({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })
    await simulateBuildingShifts({
      contextMap,
      reservedIds,
      profile,
      now: simulationTime,
      guardMap,
      counters,
    })

    const totals = [...contextMap.values()].reduce(
      (summary, context) => {
        summary[context.state.zone] = (summary[context.state.zone] || 0) + 1
        return summary
      },
      {
        hostel: 0,
        academic_building: 0,
        library: 0,
        outside_campus: 0,
      },
    )

    return {
      skipped: false,
      profile: profile.name,
      localHour: getLocalizedHour(simulationTime),
      totalStudents: students.length,
      totals,
      ...counters,
    }
  } catch (error) {
    console.error("Campus activity simulation failed:", error)
    throw error
  } finally {
    simulationInFlight = false
  }
}

const runCampusClosingSweep = async (now = new Date()) => {
  if (closingSweepInFlight) {
    return {
      skipped: true,
      reason: "closing_sweep_already_running",
    }
  }

  closingSweepInFlight = true

  try {
    const sweepTime = toDate(now)
    await closeActiveSacState({ now: sweepTime, reason: CLOSING_SWEEP_SOURCE })
    const [students, guardMap] = await Promise.all([
      getActiveStudents(),
      resolveGuardsByLocation(),
    ])

    if (students.length === 0) {
      return {
        skipped: true,
        reason: "no_active_students",
      }
    }

    const studentIds = students.map((student) => student.id)
    const movementMap = await getLatestMovementMap(prisma, studentIds)

    const movableContexts = students
      .map((student) => ({
        student,
        latestMovement: movementMap.get(student.id) || null,
      }))
      .map((item) => ({
        ...item,
        state: inferStudentState(item.student, item.latestMovement),
      }))
      .filter((context) =>
        ["academic_building", "library"].includes(context.state.zone),
      )

    let settledCount = 0

    for (const context of movableContexts) {
      const moved = await createInternalMovement({
        context,
        contextMap: null,
        fromLocation: context.state.location,
        toLocation: context.student.hostel || HOSTELS[0],
        now: sweepTime,
        guardMap,
        transition: CLOSING_SWEEP_SOURCE,
      })

      if (moved) {
        settledCount += 1
      }
    }

    return {
      skipped: false,
      settledCount,
    }
  } catch (error) {
    console.error("Campus closing sweep failed:", error)
    throw error
  } finally {
    closingSweepInFlight = false
  }
}

const runLibraryVisitSimulation = runCampusActivitySimulation
const runLibraryClosingSweep = runCampusClosingSweep

module.exports = {
  LIBRARY_LOCATION,
  LIBRARY_TIMEZONE,
  CAMPUS_TIMEZONE,
  SIMULATION_SOURCE,
  LEGACY_SIMULATION_SOURCE,
  CLOSING_SWEEP_SOURCE,
  runCampusActivitySimulation,
  runCampusClosingSweep,
  runLibraryVisitSimulation,
  runLibraryClosingSweep,
}
