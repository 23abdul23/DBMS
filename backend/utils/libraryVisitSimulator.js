const { getPrismaClient } = require("../config/prisma")
const { generateId } = require("./hashGenerator")

const prisma = getPrismaClient()

const LIBRARY_LOCATION = "Library"
const LIBRARY_TIMEZONE = "Asia/Kolkata"
const SIMULATION_SOURCE = "library_cron_simulation"
const BUSINESS_OPEN_HOUR = 7
const BUSINESS_CLOSE_HOUR = 23

const TRAFFIC_PROFILES = [
  {
    startHour: 7,
    endHour: 9,
    targetOccupancyRatio: 0.015,
    targetOccupancyCap: 12,
    turnoverRatio: 0.04,
    maxEntriesPerRun: 3,
    maxExitsPerRun: 1,
    occupancyJitter: 1,
  },
  {
    startHour: 9,
    endHour: 12,
    targetOccupancyRatio: 0.05,
    targetOccupancyCap: 35,
    turnoverRatio: 0.08,
    maxEntriesPerRun: 5,
    maxExitsPerRun: 3,
    occupancyJitter: 2,
  },
  {
    startHour: 12,
    endHour: 17,
    targetOccupancyRatio: 0.1,
    targetOccupancyCap: 60,
    turnoverRatio: 0.14,
    maxEntriesPerRun: 8,
    maxExitsPerRun: 5,
    occupancyJitter: 3,
  },
  {
    startHour: 17,
    endHour: 21,
    targetOccupancyRatio: 0.14,
    targetOccupancyCap: 85,
    turnoverRatio: 0.2,
    maxEntriesPerRun: 10,
    maxExitsPerRun: 8,
    occupancyJitter: 4,
  },
  {
    startHour: 21,
    endHour: 23,
    targetOccupancyRatio: 0.06,
    targetOccupancyCap: 40,
    turnoverRatio: 0.28,
    maxEntriesPerRun: 4,
    maxExitsPerRun: 12,
    occupancyJitter: 3,
  },
]

let simulationInFlight = false
let closingSweepInFlight = false

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(value, maximum))

const randomInt = (minimum, maximum) => {
  if (maximum <= minimum) {
    return minimum
  }

  return minimum + Math.floor(Math.random() * (maximum - minimum + 1))
}

const toDate = (value) => (value instanceof Date ? new Date(value) : new Date(value || Date.now()))

const getLocalizedHour = (value) =>
  Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: LIBRARY_TIMEZONE,
    }).format(value),
  )

const isWithinLibraryHours = (hour) => hour >= BUSINESS_OPEN_HOUR && hour < BUSINESS_CLOSE_HOUR

const getTrafficProfile = (hour) =>
  TRAFFIC_PROFILES.find((profile) => hour >= profile.startHour && hour < profile.endHour) ||
  TRAFFIC_PROFILES[TRAFFIC_PROFILES.length - 1]

const shuffle = (items) => {
  const next = [...items]

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }

  return next
}

const pickRandomItems = (items, count) => {
  if (count <= 0 || items.length === 0) {
    return []
  }

  return shuffle(items).slice(0, count)
}

const getSimulatedTimestamp = (now) => {
  const timestamp = new Date(now)
  timestamp.setSeconds(Math.max(0, timestamp.getSeconds() - randomInt(0, 45)), randomInt(0, 999))
  return timestamp
}

const resolveLibraryGuard = async () => {
  const guard = await prisma.user.findFirst({
    where: {
      role: "security",
      isActive: true,
      OR: [
        {
          securityProfile: {
            is: {
              securityPost: LIBRARY_LOCATION,
            },
          },
        },
        {
          hostel: LIBRARY_LOCATION,
        },
      ],
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

  if (!guard) {
    return null
  }

  return {
    id: guard.id,
    name: guard.name,
    guardId: guard.securityProfile?.guardId || guard.guardId || null,
  }
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
    },
  })

const getLatestLibraryMovements = async (studentIds) => {
  if (studentIds.length === 0) {
    return []
  }

  return prisma.log.findMany({
    where: {
      userId: {
        in: studentIds,
      },
      location: LIBRARY_LOCATION,
      action: {
        in: ["entry", "exit"],
      },
    },
    orderBy: [{ userId: "asc" }, { createdAt: "desc" }],
    distinct: ["userId"],
    select: {
      userId: true,
      action: true,
      createdAt: true,
    },
  })
}

const buildMovementState = (students, latestMovements) => {
  const latestByUserId = new Map(latestMovements.map((movement) => [movement.userId, movement]))
  const insideStudents = []
  const outsideStudents = []

  for (const student of students) {
    const latestMovement = latestByUserId.get(student.id)

    if (latestMovement?.action === "entry") {
      insideStudents.push(student)
      continue
    }

    outsideStudents.push(student)
  }

  return {
    insideStudents,
    outsideStudents,
  }
}

const buildSimulationLogRow = ({ userId, guard, action, now, totalStudents, insideBeforeRun }) => ({
  id: generateId(),
  userId,
  action,
  location: LIBRARY_LOCATION,
  guardId: guard.guardId,
  guardName: guard.name,
  success: true,
  details: {
    source: SIMULATION_SOURCE,
    mode: "cron",
    libraryTimezone: LIBRARY_TIMEZONE,
    insideBeforeRun,
    totalEligibleStudents: totalStudents,
    simulatedAt: now.toISOString(),
  },
  scanType: "manual",
  createdAt: getSimulatedTimestamp(now),
})

const buildSimulationPlan = ({ totalStudents, insideCount, outsideCount, hour }) => {
  const profile = getTrafficProfile(hour)
  const targetOccupancy = clamp(
    Math.round(totalStudents * profile.targetOccupancyRatio) + randomInt(-profile.occupancyJitter, profile.occupancyJitter),
    0,
    Math.min(totalStudents, profile.targetOccupancyCap),
  )

  const baseEntries = Math.max(0, targetOccupancy - insideCount)
  const baseExits = Math.max(0, insideCount - targetOccupancy)
  const turnover = clamp(Math.round(insideCount * profile.turnoverRatio), 0, profile.maxExitsPerRun)
  const exitCount = clamp(Math.max(baseExits, turnover), 0, Math.min(insideCount, profile.maxExitsPerRun))
  const balancingEntries = Math.max(0, exitCount - baseExits)
  const entryCount = clamp(
    Math.max(baseEntries, balancingEntries),
    0,
    Math.min(outsideCount, profile.maxEntriesPerRun),
  )

  return {
    entryCount,
    exitCount,
    targetOccupancy,
    profile,
  }
}

const createSimulationLogs = async ({ entryStudents, exitStudents, guard, now, totalStudents, insideBeforeRun }) => {
  const rows = [
    ...entryStudents.map((student) =>
      buildSimulationLogRow({
        userId: student.id,
        guard,
        action: "entry",
        now,
        totalStudents,
        insideBeforeRun,
      }),
    ),
    ...exitStudents.map((student) =>
      buildSimulationLogRow({
        userId: student.id,
        guard,
        action: "exit",
        now,
        totalStudents,
        insideBeforeRun,
      }),
    ),
  ]

  if (rows.length === 0) {
    return 0
  }

  const result = await prisma.log.createMany({
    data: rows,
  })

  return result.count
}

const runLibraryVisitSimulation = async (now = new Date()) => {
  if (simulationInFlight) {
    return {
      skipped: true,
      reason: "simulation_already_running",
    }
  }

  simulationInFlight = true

  try {
    const simulationTime = toDate(now)
    const localHour = getLocalizedHour(simulationTime)

    if (!isWithinLibraryHours(localHour)) {
      return {
        skipped: true,
        reason: "outside_library_hours",
        localHour,
      }
    }

    const [guard, students] = await Promise.all([resolveLibraryGuard(), getActiveStudents()])

    if (!guard?.guardId) {
      console.warn("Library visit simulation skipped: no active guard assigned to Library.")
      return {
        skipped: true,
        reason: "missing_library_guard",
      }
    }

    if (students.length === 0) {
      return {
        skipped: true,
        reason: "no_active_students",
      }
    }

    const latestMovements = await getLatestLibraryMovements(students.map((student) => student.id))
    const { insideStudents, outsideStudents } = buildMovementState(students, latestMovements)
    const plan = buildSimulationPlan({
      totalStudents: students.length,
      insideCount: insideStudents.length,
      outsideCount: outsideStudents.length,
      hour: localHour,
    })

    const exitStudents = pickRandomItems(insideStudents, plan.exitCount)
    const entryStudents = pickRandomItems(outsideStudents, plan.entryCount)
    const createdCount = await createSimulationLogs({
      entryStudents,
      exitStudents,
      guard,
      now: simulationTime,
      totalStudents: students.length,
      insideBeforeRun: insideStudents.length,
    })

    return {
      skipped: false,
      createdCount,
      entryCount: entryStudents.length,
      exitCount: exitStudents.length,
      targetOccupancy: plan.targetOccupancy,
      currentOccupancy: insideStudents.length,
      localHour,
    }
  } catch (error) {
    console.error("Library visit simulation failed:", error)
    throw error
  } finally {
    simulationInFlight = false
  }
}

const runLibraryClosingSweep = async (now = new Date()) => {
  if (closingSweepInFlight) {
    return {
      skipped: true,
      reason: "closing_sweep_already_running",
    }
  }

  closingSweepInFlight = true

  try {
    const sweepTime = toDate(now)
    const guard = await resolveLibraryGuard()

    if (!guard?.guardId) {
      console.warn("Library closing sweep skipped: no active guard assigned to Library.")
      return {
        skipped: true,
        reason: "missing_library_guard",
      }
    }

    const students = await getActiveStudents()

    if (students.length === 0) {
      return {
        skipped: true,
        reason: "no_active_students",
      }
    }

    const latestMovements = await getLatestLibraryMovements(students.map((student) => student.id))
    const { insideStudents } = buildMovementState(students, latestMovements)
    const createdCount = await createSimulationLogs({
      entryStudents: [],
      exitStudents: insideStudents,
      guard,
      now: sweepTime,
      totalStudents: students.length,
      insideBeforeRun: insideStudents.length,
    })

    return {
      skipped: false,
      createdCount,
      exitCount: insideStudents.length,
    }
  } catch (error) {
    console.error("Library closing sweep failed:", error)
    throw error
  } finally {
    closingSweepInFlight = false
  }
}

module.exports = {
  LIBRARY_LOCATION,
  LIBRARY_TIMEZONE,
  SIMULATION_SOURCE,
  runLibraryVisitSimulation,
  runLibraryClosingSweep,
}
