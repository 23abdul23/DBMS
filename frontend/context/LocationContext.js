'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import Constants from 'expo-constants';
import { locationAPI } from '../services/api';
import {
  cacheLocations,
  getCachedLocations,
} from '../utils/locationCacheManager';

const expoExtra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  Constants.manifest2?.extra ??
  {};

const appEnvironement = String(
  expoExtra.ENVIRONMENT || expoExtra.ENVIRONEMENT || ''
)
  .trim()
  .toLowerCase();

// Structured location logger
const DEBUG_LOCATION = appEnvironement === 'development';
const locationLog = (obj) => {
  if (DEBUG_LOCATION)
    console.log(
      '[LOCATION_CTX]',
      typeof obj === 'object' ? JSON.stringify(obj) : obj
    );
};

const DEFAULT_LOCATION_REFRESH_MS = 30000; // 30s
const DEFAULT_LOCATIONS_REFRESH_MS = 55 * 60 * 1000; // 55 minutes

const LocationContext = createContext(null);

export const useAppLocation = () => {
  const context = useContext(LocationContext);

  if (!context) {
    throw new Error('useAppLocation must be used within a LocationProvider');
  }

  return context;
};

export const LocationProvider = ({ children }) => {
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState(null);
  const [locations, setLocations] = useState([]);

  const locationRefreshTimer = useRef(null);
  const locationsRefreshTimer = useRef(null);

  const refreshLocation = async () => {
    if (Platform.OS === 'web') {
      return null;
    }
    setLocationLoading(true);

    try {
      locationLog({ event: 'refresh-start' });
      let permissions = await Location.getForegroundPermissionsAsync();

      if (permissions.status !== 'granted') {
        permissions = await Location.requestForegroundPermissionsAsync();
      }

      setPermissionStatus(permissions.status);
      locationLog({ event: 'permissions-status', status: permissions.status });

      if (permissions.status !== 'granted') {
        setLocation(null);
        locationLog({ event: 'refresh-aborted-permission-denied' });
        return null;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const nextLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
        timestamp: new Date().toISOString(),
      };

      setLocation(nextLocation);
      locationLog({ event: 'refresh-success', location: nextLocation });
      return nextLocation;
    } catch (error) {
      locationLog({
        event: 'refresh-error',
        error: error?.message || String(error),
      });
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  /**
   * Fetch and cache fixed locations from API
   * On success, also stores in AsyncStorage for persistence
   */
  const fetchLocations = useCallback(async (isCacheInitialization = false) => {
    try {
      locationLog({ event: 'fetch-locations-start', isCacheInitialization });
      const resp = await locationAPI.getActive();
      const locationsData = resp?.data?.locations || [];

      setLocations(locationsData);

      // Persist to AsyncStorage for next app startup
      if (locationsData.length > 0) {
        await cacheLocations(locationsData);
      }

      locationLog({
        event: 'fetch-locations-success',
        count: locationsData.length,
      });
      return locationsData;
    } catch (error) {
      locationLog({
        event: 'fetch-locations-failed',
        error: error?.response?.data || error,
      });
      return [];
    }
  }, []);

  useEffect(() => {
    refreshLocation();

    // start auto-refresh for user location
    if (!locationRefreshTimer.current) {
      locationRefreshTimer.current = setInterval(() => {
        refreshLocation();
      }, DEFAULT_LOCATION_REFRESH_MS);
    }

    // Initialize locations from cache, then refresh from API
    const initializeLocations = async () => {
      try {
        // Step 1: Load from AsyncStorage (fast, no network)
        const cachedLocations = await getCachedLocations();
        if (cachedLocations.length > 0) {
          locationLog({
            event: 'loaded-locations-from-cache',
            count: cachedLocations.length,
          });
          setLocations(cachedLocations);
        }

        // Step 2: Fetch fresh data from API (will update cache)
        await fetchLocations();
      } catch (error) {
        locationLog({
          event: 'initialize-locations-failed',
          error: error?.message || String(error),
        });
      }
    };

    initializeLocations();

    // Auto-refresh fixed locations periodically
    if (!locationsRefreshTimer.current) {
      locationsRefreshTimer.current = setInterval(() => {
        fetchLocations();
      }, DEFAULT_LOCATIONS_REFRESH_MS);
    }

    return () => {
      if (locationRefreshTimer.current) {
        clearInterval(locationRefreshTimer.current);
        locationRefreshTimer.current = null;
      }
      if (locationsRefreshTimer.current) {
        clearInterval(locationsRefreshTimer.current);
        locationsRefreshTimer.current = null;
      }
    };
  }, [fetchLocations]);

  const getLocationByName = useCallback(
    (name) => {
      if (!name) return null;
      const normalized = String(name).trim().toLowerCase();
      return (
        locations.find(
          (l) =>
            String(l.name || '')
              .trim()
              .toLowerCase() === normalized
        ) || null
      );
    },
    [locations]
  );

  const getNearestLocation = useCallback(
    (coords) => {
      if (
        !coords ||
        !coords.latitude ||
        !coords.longitude ||
        !locations?.length
      )
        return null;
      // simple linear nearest lookup using haversine (approx)
      const toRad = (d) => (d * Math.PI) / 180;
      const distance = (lat1, lon1, lat2, lon2) => {
        const R = 6371000;
        const φ1 = toRad(lat1);
        const φ2 = toRad(lat2);
        const Δφ = toRad(lat2 - lat1);
        const Δλ = toRad(lon2 - lon1);
        const a =
          Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      let best = null;
      for (const loc of locations) {
        if (!loc.latitude || !loc.longitude) continue;
        const d = distance(
          coords.latitude,
          coords.longitude,
          Number(loc.latitude),
          Number(loc.longitude)
        );
        if (best === null || d < best.distance) {
          best = { location: loc, distance: d };
        }
      }

      return best;
    },
    [locations]
  );

  return (
    <LocationContext.Provider
      value={{
        location,
        locationLoading,
        permissionStatus,
        refreshLocation,
        locations,
        getLocationByName,
        getNearestLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
