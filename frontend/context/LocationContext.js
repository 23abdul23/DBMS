'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { locationAPI } from '../services/api';

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
      let permissions = await Location.getForegroundPermissionsAsync();

      if (permissions.status !== 'granted') {
        permissions = await Location.requestForegroundPermissionsAsync();
      }

      setPermissionStatus(permissions.status);

      if (permissions.status !== 'granted') {
        setLocation(null);
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
      return nextLocation;
    } catch (error) {
      console.log('Location context error:', error);
      return null;
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    refreshLocation();

    // start auto-refresh for user location
    if (!locationRefreshTimer.current) {
      locationRefreshTimer.current = setInterval(() => {
        refreshLocation();
      }, DEFAULT_LOCATION_REFRESH_MS);
    }

    // fetch fixed locations (library, sac, etc.) and refresh periodically
    const fetchLocations = async () => {
      try {
        const resp = await locationAPI.getActive();
        setLocations(resp?.data?.locations || []);
      } catch (error) {
        console.log(
          'Failed to fetch fixed locations:',
          error?.response?.data || error
        );
      }
    };

    fetchLocations();
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
  }, []);

  const getLocationByName = (name) => {
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
  };

  const getNearestLocation = (coords) => {
    if (!coords || !coords.latitude || !coords.longitude || !locations?.length)
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
  };

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
