/**
 * Proximity Validator Service
 *
 * Validates location proximity using haversine distance calculation.
 * Core logic for checking if a user's current location is within
 * the allowed radius of a target location (SAC, QR scan point, etc.)
 *
 * Respects environment-aware settings:
 * - PRODUCTION: Validates all proximity checks
 * - DEVELOPMENT: Skips validation (allow testing from anywhere)
 */

import {
  isProximityCheckEnabled,
  PROXIMITY_THRESHOLD_METERS,
  PROXIMITY_ERRORS,
} from '../config/proximityConfig';

// Structured proximity logger
const DEBUG_PROXIMITY = __DEV__;

const proximityLog = (obj) => {
  if (DEBUG_PROXIMITY) console.log('ENV:', __DEV__);
  console.log(
    '[PROXIMITY]',
    typeof obj === 'object' ? JSON.stringify(obj) : obj
  );
};

/**
 * Calculate distance between two geographic coordinates using Haversine formula
 * Returns distance in meters
 *
 * Formula: a = sin²(Δφ/2) + cos φ1 ⋅ cos φ2 ⋅ sin²(Δλ/2)
 *          c = 2 ⋅ atan2( √a, √(1−a) )
 *          d = R ⋅ c
 * where φ is latitude, λ is longitude, R is earth's radius (6371 km)
 *
 * @param {number} lat1 - User latitude
 * @param {number} lon1 - User longitude
 * @param {number} lat2 - Target latitude
 * @param {number} lon2 - Target longitude
 * @returns {number} Distance in meters
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  // Validate inputs
  if (
    typeof lat1 !== 'number' ||
    typeof lon1 !== 'number' ||
    typeof lat2 !== 'number' ||
    typeof lon2 !== 'number'
  ) {
    console.warn(
      '[ProximityValidator] Invalid coordinates for distance calculation'
    );
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180); // Convert to radians
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c * 1000; // Convert to meters

  return Math.round(distance);
};

/**
 * Format distance for user display
 * Converts meters to readable format (e.g., "150m away" or "1.2 km away")
 *
 * @param {number} meters - Distance in meters
 * @returns {string} Formatted distance string
 */
export const formatDistance = (meters) => {
  if (typeof meters !== 'number' || meters < 0) {
    return 'Unknown distance';
  }

  if (meters < 1000) {
    return `${Math.round(meters)}m away`;
  }

  const km = (meters / 1000).toFixed(1);
  return `${km}km away`;
};

/**
 * Validate if user location is within proximity of target
 *
 * Process:
 * 1. Check if proximity validation is enabled (production only)
 * 2. If disabled (dev mode), return valid
 * 3. Calculate distance using Haversine formula
 * 4. Compare against threshold
 * 5. Return validation result with distance
 *
 * @param {Object} userCoords - {latitude, longitude} of user
 * @param {Object} targetLocation - {latitude, longitude, name} of target
 * @param {number} radiusMeters - Allowed proximity radius (default 150m)
 * @returns {Object} {
 *   isValid: boolean,
 *   distance: number (meters),
 *   error: string (if not valid),
 *   formattedDistance: string,
 *   threshold: number,
 *   mode: 'dev' | 'production'
 * }
 */
export const validateProximity = (
  userCoords,
  targetLocation,
  radiusMeters = PROXIMITY_THRESHOLD_METERS
) => {
  // Step 1: Validate inputs
  if (
    !userCoords ||
    typeof userCoords.latitude !== 'number' ||
    typeof userCoords.longitude !== 'number'
  ) {
    return {
      isValid: false,
      distance: null,
      error: PROXIMITY_ERRORS.LOCATION_UNAVAILABLE,
      formattedDistance: null,
      threshold: radiusMeters,
      mode: 'production',
      reason: 'invalid_user_coords',
    };
  }

  if (
    !targetLocation ||
    typeof targetLocation.latitude !== 'number' ||
    typeof targetLocation.longitude !== 'number'
  ) {
    return {
      isValid: false,
      distance: null,
      error: PROXIMITY_ERRORS.LOCATION_NOT_CONFIGURED,
      formattedDistance: null,
      threshold: radiusMeters,
      mode: 'production',
      reason: 'invalid_target_location',
    };
  }

  // Step 2: Check if validation is enabled (dev vs prod)
  const validationEnabled = isProximityCheckEnabled();
  const mode = validationEnabled ? 'production' : 'dev';

  if (!validationEnabled) {
    // Dev mode: skip validation
    const distance = calculateDistance(
      userCoords.latitude,
      userCoords.longitude,
      targetLocation.latitude,
      targetLocation.longitude
    );

    proximityLog({
      event: 'dev-bypass',
      target: targetLocation?.name,
      distance,
      formattedDistance: formatDistance(distance),
    });

    return {
      isValid: true,
      distance,
      error: null,
      formattedDistance: formatDistance(distance),
      threshold: radiusMeters,
      mode: 'dev',
      reason: 'dev_mode_bypass',
    };
  }

  // Step 3: Calculate distance
  const distance = calculateDistance(
    userCoords.latitude,
    userCoords.longitude,
    targetLocation.latitude,
    targetLocation.longitude
  );

  if (distance === null) {
    return {
      isValid: false,
      distance: null,
      error: PROXIMITY_ERRORS.LOCATION_UNAVAILABLE,
      formattedDistance: null,
      threshold: radiusMeters,
      mode: 'production',
      reason: 'distance_calculation_failed',
    };
  }

  // Step 4: Compare against threshold
  const isValid = distance <= radiusMeters;
  const formattedDistance = formatDistance(distance);

  const result = {
    isValid,
    distance,
    error: isValid ? null : PROXIMITY_ERRORS.OUT_OF_RANGE,
    formattedDistance,
    threshold: radiusMeters,
    mode: 'production',
    reason: isValid ? 'within_range' : 'out_of_range',
  };

  proximityLog({
    event: 'validation-result',
    target: targetLocation?.name,
    isValid,
    distance,
    formattedDistance,
    threshold: radiusMeters,
  });

  return result;
};

/**
 * Check if proximity validation is enabled in this app environment
 * Returns false in development, true in production
 *
 * @returns {boolean} true if validation should be enforced
 */
export const isValidationEnabled = () => {
  return isProximityCheckEnabled();
};

/**
 * Get the current proximity threshold in meters
 *
 * @returns {number} Proximity threshold in meters
 */
export const getProximityThreshold = () => {
  return PROXIMITY_THRESHOLD_METERS;
};

/**
 * Check proximity for multiple target locations
 * Returns the closest location within proximity
 *
 * Useful for finding nearest accessible building/location
 *
 * @param {Object} userCoords - {latitude, longitude}
 * @param {Array} targetLocations - Array of location objects
 * @param {number} radiusMeters - Proximity threshold
 * @returns {Array} Array of {location, distance, isValid}, sorted by distance
 */
export const validateProximityMultiple = (
  userCoords,
  targetLocations = [],
  radiusMeters = PROXIMITY_THRESHOLD_METERS
) => {
  if (!Array.isArray(targetLocations) || !userCoords) {
    return [];
  }

  return targetLocations
    .map((location) => {
      const validation = validateProximity(userCoords, location, radiusMeters);
      return {
        location,
        distance: validation.distance,
        isValid: validation.isValid,
        formattedDistance: validation.formattedDistance,
      };
    })
    .sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
};

/**
 * Get nearby locations within radius
 * Filters to only locations within proximity threshold
 *
 * @param {Object} userCoords - {latitude, longitude}
 * @param {Array} allLocations - All available locations
 * @param {number} radiusMeters - Proximity threshold
 * @returns {Array} Locations within radius, sorted by distance
 */
export const getNearbyLocations = (
  userCoords,
  allLocations = [],
  radiusMeters = PROXIMITY_THRESHOLD_METERS
) => {
  const validated = validateProximityMultiple(
    userCoords,
    allLocations,
    radiusMeters
  );
  return validated.filter((v) => v.isValid);
};
