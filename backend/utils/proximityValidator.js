export const toRadians = (deg) => (deg * Math.PI) / 180

export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (
    lat1 === null ||
    lat1 === undefined ||
    lon1 === null ||
    lon1 === undefined ||
    lat2 === null ||
    lat2 === undefined ||
    lon2 === null ||
    lon2 === undefined
  ) {
    return null
  }

  const R = 6371000 // metres
  const φ1 = toRadians(Number(lat1))
  const φ2 = toRadians(Number(lat2))
  const Δφ = toRadians(Number(lat2) - Number(lat1))
  const Δλ = toRadians(Number(lon2) - Number(lon1))

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  return R * c
}

export const isWithinProximity = (
  userCoords,
  targetCoords,
  thresholdMeters = null,
) => {
  const env = (
    process.env.ENVIRONEMENT ||
    process.env.NODE_ENV ||
    "development"
  ).toLowerCase()

  // In non-production environments we bypass proximity checks
  if (env !== "production") {
    return { isWithin: true, distance: 0 }
  }

  const lat1 = userCoords?.latitude
  const lon1 = userCoords?.longitude
  const lat2 = targetCoords?.latitude
  const lon2 = targetCoords?.longitude

  const distance = calculateDistance(lat1, lon1, lat2, lon2)

  if (distance === null) {
    return { isWithin: false, distance: null, reason: "missing_coordinates" }
  }

  const threshold = Number(
    thresholdMeters || process.env.PROXIMITY_THRESHOLD_METERS || 150,
  )

  return { isWithin: distance <= threshold, distance }
}

export default { calculateDistance, isWithinProximity }
