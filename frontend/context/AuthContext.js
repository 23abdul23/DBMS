'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  authAPI,
  commonAPI,
  notificationAPI,
  locationAPI,
} from '../services/api';
import * as SecureStore from 'expo-secure-store';
import {
  setLogoutCallback,
  clearLogoutCallback,
} from '../utils/logoutEventEmitter';
import { deactivateCurrentDevicePushRegistration } from '../notifications/notificationService';
import { cacheLocations } from '../utils/locationCacheManager';
import { createLogger, serializeError } from '../utils/logger';

const normalizeLoginRole = (role) => {
  if (role === 'sac_admin' || role === 'library_admin') {
    return 'admin';
  }

  return role;
};

const AuthContext = createContext();
const authLogger = createLogger('auth', 'Auth');

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [impersonatedRole, setImpersonatedRole] = useState(null);
  const [impersonatedUserId, setImpersonatedUserId] = useState(null);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  // Register logout callback for axios interceptor
  useEffect(() => {
    setLogoutCallback(logout);

    return () => {
      clearLogoutCallback();
    };
  }, []);

  const loadStoredAuth = async () => {
    try {
      const accessToken = await SecureStore.getItemAsync('accessToken');

      const refreshToken = await SecureStore.getItemAsync('refreshToken');

      const storedUser = await AsyncStorage.getItem('userData');

      if (accessToken && refreshToken && storedUser) {
        setToken(accessToken);

        setUser(JSON.parse(storedUser));
      } else {
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      authLogger.warn('failed-to-load-stored-auth', serializeError(error));
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password, role) => {
    try {
      const response = await authAPI.login(
        email,
        password,
        normalizeLoginRole(role)
      );
      const { accessToken, refreshToken, user: userData } = response.data;

      await SecureStore.setItemAsync('accessToken', accessToken);

      await SecureStore.setItemAsync('refreshToken', refreshToken);

      await AsyncStorage.setItem('userData', JSON.stringify(userData));

      setToken(accessToken);
      setUser(userData);

      // [NEW] Preload active locations after login (non-blocking)
      // This caches locations in AsyncStorage so app doesn't need to fetch on startup
      try {
        const locationsResponse = await locationAPI.getActive();
        const locationsData = locationsResponse?.data?.locations || [];

        if (locationsData.length > 0) {
          await cacheLocations(locationsData);
          authLogger.info('preloaded-active-locations', {
            count: locationsData.length,
          });
        }
      } catch (locError) {
        authLogger.warn(
          'location-preload-failed-non-blocking',
          serializeError(locError)
        );
      }

      return { success: true };
    } catch (error) {
      authLogger.warn('login-failed', {
        status: error?.response?.status,
        code: error?.response?.data?.code,
        message: error?.response?.data?.message || error?.message,
      });
      return {
        success: false,
        error: error.response?.data?.message || 'Login failed',
      };
    }
  };

  const setAuthenticatedUser = async (userData) => {
    await AsyncStorage.setItem('userData', JSON.stringify(userData));
    setUser(userData);
  };

  const refreshUser = async () => {
    const response = await commonAPI.getProfile();
    const latestUser = response.data?.user || response.data?.userData || null;

    if (latestUser) {
      await setAuthenticatedUser(latestUser);
    }

    return latestUser;
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      return { success: true, data: response.data };
    } catch (error) {
      authLogger.warn('registration-failed', serializeError(error));
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = async (reason = 'USER_REQUESTED') => {
    try {
      authLogger.info('logout-started', { reason });

      // Try to notify backend if it's a user-requested logout (not forced by session revocation)
      if (reason === 'USER_REQUESTED') {
        try {
          const pushRegistration =
            await deactivateCurrentDevicePushRegistration();

          await notificationAPI
            .deactivateToken({
              ...pushRegistration,
              reason: 'user_logout',
            })
            .catch(() => {});
        } catch (pushError) {
          authLogger.warn(
            'push-token-deactivation-failed-non-blocking',
            serializeError(pushError)
          );
        }

        try {
          // Ignore errors - user might already be logged out
          await authAPI.logout?.().catch(() => {});
        } catch (err) {
          authLogger.warn(
            'logout-api-call-failed',
            serializeError(err)
          );
        }
      }

      // Always clear local storage
      await Promise.all([
        SecureStore.deleteItemAsync('accessToken').catch(() => {}),
        SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
        AsyncStorage.removeItem('userData').catch(() => {}),
      ]);

      // [NOTE] Intentionally NOT clearing location cache on logout
      // Locations are public campus data; can be reused on next login
      // This reduces API calls and improves login speed

      setToken(null);
      setUser(null);
      // Also clear impersonation state on logout
      setImpersonatedRole(null);
      setImpersonatedUserId(null);

      authLogger.info('logout-complete', { reason });
    } catch (error) {
      authLogger.error('logout-failed', serializeError(error));
      // Still clear state even if there's an error
      setToken(null);
      setUser(null);
      setImpersonatedRole(null);
      setImpersonatedUserId(null);
    }
  };

  // SUPER_ADMIN impersonation helpers
  const startImpersonation = (role, userId) => {
    setImpersonatedRole(role);
    setImpersonatedUserId(userId);
    authLogger.info('impersonation-started', { role, userId });
  };

  const clearImpersonation = () => {
    setImpersonatedRole(null);
    setImpersonatedUserId(null);
    authLogger.info('impersonation-cleared');
  };

  const getDisplayRole = () => {
    return impersonatedRole || user?.role;
  };

  const isImpersonating = () => {
    return impersonatedRole !== null;
  };

  const value = {
    user,
    token,
    loading,
    login,
    register,
    refreshUser,
    setAuthenticatedUser,
    logout,
    // SUPER_ADMIN impersonation
    impersonatedRole,
    impersonatedUserId,
    startImpersonation,
    clearImpersonation,
    getDisplayRole,
    isImpersonating,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
