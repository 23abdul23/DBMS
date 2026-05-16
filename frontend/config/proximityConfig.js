/**
 * Centralized Proximity Validation Configuration
 *
 * Controls proximity middleware behavior across the app:
 * - Production mode: Validates location proximity before SAC/scan actions
 * - Development mode: Bypasses all proximity validation
 *
 * Key settings:
 * - PROXIMITY_ENABLED: true only in production builds
 * - PROXIMITY_THRESHOLD_METERS: Distance radius from backend .env (150m default)
 * - LOCATION_STALENESS_THRESHOLD: How old location can be before refresh (5 min)
 */

import { Platform } from 'react-native';

/**
 * Check if proximity validation should be enabled.
 *
 * Returns true in PRODUCTION builds only.
 * In development (__DEV__ === true), always returns false to allow testing.
 *
 * @returns {boolean} true if validation should be enforced
 */
export const isProximityCheckEnabled = () => {
  // __DEV__ is a global constant in React Native
  // true in dev mode, false in production builds
  return !__DEV__;
};

/**
 * Proximity threshold in meters (from backend config)
 * Students must be within this distance to access SAC/scan QR
 * @type {number}
 */
export const PROXIMITY_THRESHOLD_METERS = 150;

/**
 * How old user location can be before it's considered stale
 * If location is older, useLocationGuard will attempt refresh
 * @type {number} milliseconds
 */
export const LOCATION_STALENESS_THRESHOLD = 5 * 60 * 1000; // 5 minutes

/**
 * TTL for cached locations in AsyncStorage
 * After this time, a fresh fetch from API is recommended
 * @type {number} milliseconds
 */
export const LOCATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Automatic GPS refresh interval in LocationContext
 * Keep at 30s for real-time location tracking
 * @type {number} milliseconds
 */
export const GPS_REFRESH_INTERVAL = 30 * 1000; // 30 seconds

/**
 * Fixed locations (campus buildings, gates) refresh interval
 * These change infrequently; refresh every 55 minutes
 * @type {number} milliseconds
 */
export const LOCATIONS_REFRESH_INTERVAL = 55 * 60 * 1000; // 55 minutes

/**
 * AsyncStorage keys for location caching
 * @type {Object}
 */
export const ASYNC_STORAGE_KEYS = {
  LOCATIONS_CACHE: '@aegis_locations_cache',
  LOCATIONS_CACHE_TS: '@aegis_locations_cache_ts',
};

/**
 * Error messages for proximity validation
 * @type {Object}
 */
export const PROXIMITY_ERRORS = {
  OUT_OF_RANGE: 'You are too far from the location. Please move closer.',
  PERMISSION_DENIED: 'Location permission denied. Enable in Settings.',
  LOCATION_UNAVAILABLE: 'Unable to get your current location.',
  LOCATION_NOT_CONFIGURED: 'This location is not configured in the system.',
  TIMEOUT: 'Location fetch timed out. Please try again.',
};

/**
 * Device platform check
 * Proximity validation only works on native platforms (not web)
 * @type {string}
 */
export const DEVICE_PLATFORM = Platform.OS; // 'ios', 'android', or 'web'

/**
 * Proximity validation is only available on mobile platforms
 * @type {boolean}
 */
export const IS_MOBILE_PLATFORM =
  Platform.OS === 'ios' || Platform.OS === 'android';
