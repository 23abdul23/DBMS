/**
 * Location Guard Hook - Middleware for Proximity Validation
 *
 * This is the primary middleware for SAC/scan actions that require proximity checks.
 * It orchestrates the complete validation flow:
 *
 * 1. Get current user location (refresh if stale)
 * 2. Find target location from cache
 * 3. Validate proximity (development bypass)
 * 4. Execute API callback on success
 * 5. Handle errors gracefully
 *
 * Usage:
 *   const { validateAndExecute } = useLocationGuard();
 *
 *   const handleScan = async () => {
 *     const result = await validateAndExecute('QR_Location', () => {
 *       return securityAPI.logStudentScan(payload);
 *     });
 *
 *     if (!result.success) {
 *       Alert.alert('Error', result.error);
 *       return;
 *     }
 *
 *     // API call succeeded
 *   };
 */

import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useAppLocation } from '../context/LocationContext';
import { validateProximity } from '../services/proximityValidator';
import {
  getCachedLocations,
  getLocationByName,
} from '../utils/locationCacheManager';
import {
  LOCATION_STALENESS_THRESHOLD,
  PROXIMITY_ERRORS,
} from '../config/proximityConfig';

// Structured location/proximity logger
const DEBUG_LOCATION = __DEV__;
const locationLog = (obj) => {
  if (DEBUG_LOCATION)
    console.log(
      '[LOCATION_GUARD]',
      typeof obj === 'object' ? JSON.stringify(obj) : obj
    );
};

/**
 * Hook for location-guarded actions
 * Handles proximity validation and stale location refresh
 *
 * @returns {Object} { validateAndExecute }
 */
export const useLocationGuard = () => {
  const {
    location: currentLocation,
    refreshLocation,
    permissionStatus,
  } = useAppLocation();

  // Prevent concurrent location refreshes
  const isRefreshingRef = useRef(false);

  /**
   * Check if current location is stale (older than threshold)
   *
   * @returns {boolean} true if stale
   */
  const isLocationStale = useCallback(() => {
    if (!currentLocation || !currentLocation.timestamp) {
      return true;
    }

    const age = Date.now() - new Date(currentLocation.timestamp).getTime();
    return age > LOCATION_STALENESS_THRESHOLD;
  }, [currentLocation]);

  /**
   * Ensure fresh location data
   * Refreshes if stale, handles permission denial
   *
   * @returns {Promise<Object|null>} Fresh location or null if unavailable
   */
  const ensureFreshLocation = useCallback(async () => {
    // If location is fresh enough, use it
    if (currentLocation && !isLocationStale()) {
      return currentLocation;
    }

    // Check permission status
    if (permissionStatus === 'denied') {
      return null;
    }

    // Avoid concurrent refresh calls
    if (isRefreshingRef.current) {
      // Wait for refresh to complete
      let retries = 0;
      while (isRefreshingRef.current && retries < 50) {
        await new Promise((r) => setTimeout(r, 100));
        retries++;
      }
      return currentLocation;
    }

    // Trigger refresh
    isRefreshingRef.current = true;
    try {
      const refreshed = await refreshLocation();
      // Return the freshly obtained location (refreshLocation returns the new location)
      // Fallback to the existing `currentLocation` if refresh returned null
      return refreshed || currentLocation;
    } catch (error) {
      console.error('[LocationGuard] Failed to refresh location:', error);
      return null;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [currentLocation, isLocationStale, permissionStatus, refreshLocation]);

  /**
   * Main validation and execution function
   *
   * Process:
   * 1. Refresh location if stale
   * 2. Get target location from cache
   * 3. Validate proximity
   * 4. Execute callback if valid
   * 5. Return result with detailed error info
   *
   * @param {string} targetLocationName - Name of target location
   * @param {Function} apiCallback - Async function to execute on success
   * @param {Object} options - Additional options
   * @param {string} options.actionName - Action name for logging
   * @param {number} options.radiusMeters - Custom proximity radius
   * @param {boolean} options.showAlert - Show error alert (default: true)
   * @returns {Promise<Object>} {
   *   success: boolean,
   *   error: string (if failed),
   *   distance: number (meters),
   *   formattedDistance: string,
   *   reason: string (why validation failed),
   *   apiError: Error (if API call failed)
   * }
   */
  const validateAndExecute = useCallback(
    async (targetLocationName, apiCallback, options = {}) => {
      const {
        actionName = 'Action',
        radiusMeters = undefined,
        showAlert = true,
      } = options;

      try {
        // Step 1: Ensure fresh location
        locationLog({ event: 'ensure-fresh-location-start', actionName });
        const freshLocation = await ensureFreshLocation();

        if (!freshLocation) {
          // Permission denied or location unavailable
          const error =
            permissionStatus === 'denied'
              ? PROXIMITY_ERRORS.PERMISSION_DENIED
              : PROXIMITY_ERRORS.LOCATION_UNAVAILABLE;

          const result = {
            success: false,
            error,
            distance: null,
            formattedDistance: null,
            reason:
              permissionStatus === 'denied'
                ? 'permission_denied'
                : 'no_location',
          };

          if (showAlert) {
            Alert.alert('Location Required', error, [{ text: 'OK' }]);
          }

          locationLog({
            event: 'ensure-fresh-location-failed',
            actionName,
            error,
            permissionStatus,
          });
          return result;
        }

        // Step 2: Get target location from cache
        locationLog({ event: 'target-lookup', actionName, targetLocationName });
        const cachedLocations = await getCachedLocations();
        const targetLocation = getLocationByName(
          targetLocationName,
          cachedLocations
        );

        if (!targetLocation) {
          const error = `Location "${targetLocationName}" not configured`;
          const result = {
            success: false,
            error,
            distance: null,
            formattedDistance: null,
            reason: 'location_not_found',
          };
          locationLog({
            event: 'target-not-configured',
            actionName,
            targetLocationName,
          });
          return result;
        }

        // Step 3: Validate proximity
        locationLog({
          event: 'proximity-validate-start',
          actionName,
          targetLocationName,
        });
        const validation = validateProximity(
          {
            latitude: freshLocation.latitude,
            longitude: freshLocation.longitude,
          },
          {
            latitude: targetLocation.latitude,
            longitude: targetLocation.longitude,
            name: targetLocation.name,
          },
          radiusMeters
        );

        if (!validation.isValid) {
          const result = {
            success: false,
            error: validation.error,
            distance: validation.distance,
            formattedDistance: validation.formattedDistance,
            reason: 'out_of_range',
          };

          if (showAlert) {
            Alert.alert(
              'Out of Range',
              `${validation.formattedDistance}. ${validation.error}`,
              [{ text: 'OK' }]
            );
          }

          locationLog({
            event: 'proximity-validate-failed',
            actionName,
            targetLocationName,
            distance: validation.distance,
            formattedDistance: validation.formattedDistance,
          });
          return result;
        }

        // Step 4: Execute callback
        locationLog({
          event: 'proximity-validate-success',
          actionName,
          targetLocationName,
          distance: validation.distance,
        });
        try {
          const apiResult = await apiCallback();

          const result = {
            success: true,
            error: null,
            distance: validation.distance,
            formattedDistance: validation.formattedDistance,
            reason: 'success',
            apiResult,
          };

          locationLog({
            event: 'action-executed-success',
            actionName,
            targetLocationName,
            distance: validation.distance,
            formattedDistance: validation.formattedDistance,
          });
          return result;
        } catch (apiError) {
          locationLog({
            event: 'action-executed-api-error',
            actionName,
            targetLocationName,
            apiError:
              apiError?.response?.data || apiError?.message || String(apiError),
          });

          // Check if backend rejected due to location (shouldn't happen with frontend validation)
          if (apiError?.response?.data?.code === 'LOCATION_OUT_OF_RANGE') {
            locationLog({
              event: 'backend-location-rejected',
              actionName,
              code: apiError?.response?.data?.code,
            });
          }

          return {
            success: false,
            error: apiError?.message || 'API request failed',
            distance: validation.distance,
            formattedDistance: validation.formattedDistance,
            reason: 'api_error',
            apiError,
          };
        }
      } catch (error) {
        locationLog({
          event: 'unexpected-error',
          actionName,
          error: error?.message || String(error),
        });

        return {
          success: false,
          error: error?.message || 'An unexpected error occurred',
          distance: null,
          formattedDistance: null,
          reason: 'unknown_error',
        };
      }
    },
    [ensureFreshLocation, permissionStatus]
  );

  return {
    validateAndExecute,
    isLocationStale,
  };
};
