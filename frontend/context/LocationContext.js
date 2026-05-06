'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

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
  }, []);

  return (
    <LocationContext.Provider
      value={{
        location,
        locationLoading,
        permissionStatus,
        refreshLocation,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};
