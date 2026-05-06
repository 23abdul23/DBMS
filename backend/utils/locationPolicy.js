export const EXIT_GATES = ["Gate 1", "Gate 2", "Gate 3 (Main Gate)", "Gate 4"]
export const CAMPUS_BUILDINGS = [
  "Library",
  "SAC",
  "Auditorium",
  "CC1",
  "CC2",
  "CC3",
  "AAA",
  "Lecture Theatre",
]
export const HOSTELS = [
  "BH 1",
  "BH 2",
  "BH 3",
  "BH 4",
  "BH 5",
  "GH 1",
  "GH 2",
  "GH 3",
]

export const GATE_EXIT_CUTOFF_HOUR = 18
export const GATE_EXIT_CUTOFF_MINUTE = 0

export const normalizeLocationKey = (value) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")

const canonicalLocationMap = new Map(
  [...EXIT_GATES, ...CAMPUS_BUILDINGS, ...HOSTELS].map((location) => [
    normalizeLocationKey(location),
    location,
  ]),
)

const locationAliases = new Map([
  ["gate 3", "Gate 3 (Main Gate)"],
  ["gate 3 main gate", "Gate 3 (Main Gate)"],
  ["lecture theature", "Lecture Theatre"],
  ["lecture theatre", "Lecture Theatre"],
])

export const resolveCanonicalLocation = (value) => {
  const normalized = normalizeLocationKey(value)
  if (!normalized) {
    return null
  }

  return (
    locationAliases.get(normalized) ||
    canonicalLocationMap.get(normalized) ||
    String(value).trim()
  )
}

export const classifyLocation = (value) => {
  const name = resolveCanonicalLocation(value)

  if (!name) {
    return { name: null, type: "unknown" }
  }

  if (EXIT_GATES.includes(name)) {
    return { name, type: "exit_gate" }
  }

  if (CAMPUS_BUILDINGS.includes(name)) {
    return { name, type: "campus_building" }
  }

  if (HOSTELS.includes(name)) {
    return { name, type: "hostel" }
  }

  return { name, type: "unknown" }
}

export const isExitGate = (value) =>
  classifyLocation(value).type === "exit_gate"

export const isCampusBuilding = (value) =>
  classifyLocation(value).type === "campus_building"

export const isHostel = (value) => classifyLocation(value).type === "hostel"

export const getGateExitCutoffTime = (value = new Date()) => {
  const cutoff = new Date(value)
  cutoff.setHours(GATE_EXIT_CUTOFF_HOUR, GATE_EXIT_CUTOFF_MINUTE, 0, 0)
  return cutoff
}

export const isAfterGateExitCutoff = (value = new Date()) =>
  value >= getGateExitCutoffTime(value)

export const requiresOutpassForExit = (location, now = new Date()) =>
  isExitGate(location) && isAfterGateExitCutoff(now)
