const EXIT_GATES = ["Gate 1", "Gate 2", "Gate 3 (Main Gate)", "Gate 4"]
const CAMPUS_BUILDINGS = [
  "Library",
  "SAC",
  "Auditorium",
  "CC1",
  "CC2",
  "CC3",
  "AAA",
  "Lecture Theatre",
]
const HOSTELS = ["BH 1", "BH 2", "BH 3", "BH 4", "BH 5", "GH 1", "GH 2", "GH 3"]

const GATE_EXIT_CUTOFF_HOUR = 18
const GATE_EXIT_CUTOFF_MINUTE = 0

const normalizeLocationKey = (value) =>
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

const resolveCanonicalLocation = (value) => {
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

const classifyLocation = (value) => {
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

const isExitGate = (value) => classifyLocation(value).type === "exit_gate"

const isCampusBuilding = (value) =>
  classifyLocation(value).type === "campus_building"

const isHostel = (value) => classifyLocation(value).type === "hostel"

const getGateExitCutoffTime = (value = new Date()) => {
  const cutoff = new Date(value)
  cutoff.setHours(GATE_EXIT_CUTOFF_HOUR, GATE_EXIT_CUTOFF_MINUTE, 0, 0)
  return cutoff
}

const isAfterGateExitCutoff = (value = new Date()) =>
  value >= getGateExitCutoffTime(value)

const requiresOutpassForExit = (location, now = new Date()) =>
  isExitGate(location) && isAfterGateExitCutoff(now)

module.exports = {
  EXIT_GATES,
  CAMPUS_BUILDINGS,
  HOSTELS,
  GATE_EXIT_CUTOFF_HOUR,
  GATE_EXIT_CUTOFF_MINUTE,
  normalizeLocationKey,
  resolveCanonicalLocation,
  classifyLocation,
  isExitGate,
  isCampusBuilding,
  isHostel,
  getGateExitCutoffTime,
  isAfterGateExitCutoff,
  requiresOutpassForExit,
}
