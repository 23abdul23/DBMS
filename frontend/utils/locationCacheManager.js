/**
 * Location Cache Manager
 *
 * Handles AsyncStorage persistence of active campus locations.
 * Locations are fetched from API during login and cached locally.
 * This eliminates repeated API calls for location data across app lifetime.
 *
 * Cache lifecycle:
 * - Login: Fetch from API, store in AsyncStorage + context
 * - App init: Load from AsyncStorage (no API call on startup)
 * - Periodic refresh (55min): Update cache with fresh data
 * - 24hr TTL: Mark for refresh on next app open
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ASYNC_STORAGE_KEYS,
  LOCATION_CACHE_TTL,
} from '../config/proximityConfig';

/**
 * Store locations in AsyncStorage with timestamp
 * Called after successful login and periodic refreshes
 *
 * @param {Array} locations - Array of location objects from API
 * @returns {Promise<boolean>} true if successful
 */
export const cacheLocations = async (locations) => {
  try {
    if (!Array.isArray(locations)) {
      console.warn(
        '[LocationCache] Attempted to cache invalid locations:',
        locations
      );
      return false;
    }

    const timestamp = new Date().toISOString();

    // Store both locations and timestamp
    await Promise.all([
      AsyncStorage.setItem(
        ASYNC_STORAGE_KEYS.LOCATIONS_CACHE,
        JSON.stringify(locations)
      ),
      AsyncStorage.setItem(ASYNC_STORAGE_KEYS.LOCATIONS_CACHE_TS, timestamp),
    ]);

    console.log(
      `[LocationCache] Cached ${locations.length} locations at ${timestamp}`
    );
    return true;
  } catch (error) {
    console.error('[LocationCache] Failed to cache locations:', error);
    return false;
  }
};

/**
 * Retrieve locations from AsyncStorage
 * Called on app init (before login) and as fallback
 *
 * @returns {Promise<Array>} Cached locations or empty array if not found
 */
export const getCachedLocations = async () => {
  try {
    const cached = await AsyncStorage.getItem(
      ASYNC_STORAGE_KEYS.LOCATIONS_CACHE
    );

    if (!cached) {
      console.log('[LocationCache] No cached locations found');
      return [];
    }

    const locations = JSON.parse(cached);

    if (!Array.isArray(locations)) {
      console.warn('[LocationCache] Cached data is not an array, discarding');
      await clearLocationCache();
      return [];
    }

    console.log(
      `[LocationCache] Retrieved ${locations.length} locations from cache`
    );
    return locations;
  } catch (error) {
    console.error(
      '[LocationCache] Failed to retrieve cached locations:',
      error
    );
    return [];
  }
};

/**
 * Get timestamp of when locations were cached
 * Used to determine if cache is stale
 *
 * @returns {Promise<string|null>} ISO timestamp or null if not cached
 */
export const getCacheTimestamp = async () => {
  try {
    const timestamp = await AsyncStorage.getItem(
      ASYNC_STORAGE_KEYS.LOCATIONS_CACHE_TS
    );
    return timestamp;
  } catch (error) {
    console.error('[LocationCache] Failed to retrieve cache timestamp:', error);
    return null;
  }
};

/**
 * Check if cached locations are stale
 * Cache is considered stale after LOCATION_CACHE_TTL (24 hours)
 *
 * @returns {Promise<boolean>} true if cache is stale or doesn't exist
 */
export const isCacheStale = async () => {
  try {
    const timestamp = await getCacheTimestamp();

    if (!timestamp) {
      console.log('[LocationCache] No cache timestamp found, cache is stale');
      return true;
    }

    const cacheAge = Date.now() - new Date(timestamp).getTime();
    const isStale = cacheAge > LOCATION_CACHE_TTL;

    if (isStale) {
      console.log(
        `[LocationCache] Cache is stale (${Math.round(
          cacheAge / 1000 / 60
        )} min old)`
      );
    }

    return isStale;
  } catch (error) {
    console.error('[LocationCache] Failed to check cache staleness:', error);
    return true; // Treat as stale on error
  }
};

/**
 * Clear all location cache data
 * Called on logout or when cache is corrupted
 *
 * @returns {Promise<boolean>} true if successful
 */
export const clearLocationCache = async () => {
  try {
    await Promise.all([
      AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.LOCATIONS_CACHE),
      AsyncStorage.removeItem(ASYNC_STORAGE_KEYS.LOCATIONS_CACHE_TS),
    ]);

    console.log('[LocationCache] Cleared location cache');
    return true;
  } catch (error) {
    console.error('[LocationCache] Failed to clear cache:', error);
    return false;
  }
};

/**
 * Find location by name in cached locations
 * Case-insensitive search
 *
 * @param {string} name - Location name to search for
 * @param {Array} cachedLocations - Array of cached location objects
 * @returns {Object|null} Location object if found, null otherwise
 */
export const getLocationByName = (name, cachedLocations = []) => {
  if (!name || typeof name !== 'string') {
    return null;
  }

  const normalizedName = name.toLowerCase().trim();
  const found = cachedLocations.find(
    (loc) => loc.name && loc.name.toLowerCase().trim() === normalizedName
  );

  return found || null;
};

/**
 * Get location by ID in cached locations
 *
 * @param {string} id - Location ID to search for
 * @param {Array} cachedLocations - Array of cached location objects
 * @returns {Object|null} Location object if found, null otherwise
 */
export const getLocationById = (id, cachedLocations = []) => {
  if (!id) return null;

  return cachedLocations.find((loc) => loc.id === id) || null;
};

/**
 * Get all active locations from cache
 * Filter to only locations marked as active
 *
 * @param {Array} cachedLocations - Array of cached location objects
 * @returns {Array} Active locations only
 */
export const getActiveLocations = (cachedLocations = []) => {
  return cachedLocations.filter((loc) => loc.isActive !== false);
};

/**
 * Get locations by type (e.g., 'gate', 'building', 'hostel')
 *
 * @param {string} type - Location type to filter by
 * @param {Array} cachedLocations - Array of cached location objects
 * @returns {Array} Locations matching the type
 */
export const getLocationsByType = (type, cachedLocations = []) => {
  if (!type) return cachedLocations;

  const normalizedType = type.toLowerCase().trim();
  return cachedLocations.filter(
    (loc) => loc.type && loc.type.toLowerCase().trim() === normalizedType
  );
};

/**
 * Format cache status for debugging
 *
 * @param {Array} cachedLocations - Current cached locations
 * @returns {Promise<Object>} Cache status info
 */
export const getCacheStatus = async (cachedLocations = []) => {
  const timestamp = await getCacheTimestamp();
  const isStale = await isCacheStale();

  return {
    count: cachedLocations.length,
    timestamp,
    isStale,
    cacheAge: timestamp
      ? Math.round((Date.now() - new Date(timestamp).getTime()) / 1000 / 60)
      : null,
    ttlMinutes: Math.round(LOCATION_CACHE_TTL / 1000 / 60),
  };
};
