'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, commonAPI } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import {
  setLogoutCallback,
  clearLogoutCallback,
} from '../utils/logoutEventEmitter';

const normalizeLoginRole = (role) => {
  if (role === 'sac_admin' || role === 'library_admin') {
    return 'admin';
  }

  return role;
};

const AuthContext = createContext();

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
      console.log('Error loading stored auth:', error);
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

      return { success: true };
    } catch (error) {
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
      console.log(error);
      return {
        success: false,
        error: error.response?.data?.message || 'Registration failed',
      };
    }
  };

  const logout = async (reason = 'USER_REQUESTED') => {
    try {
      console.log('[AuthContext] Logging out - Reason:', reason);

      // Try to notify backend if it's a user-requested logout (not forced by session revocation)
      if (reason === 'USER_REQUESTED') {
        try {
          // Ignore errors - user might already be logged out
          await authAPI.logout?.().catch(() => {});
        } catch (err) {
          console.log(
            '[AuthContext] Logout API call failed (expected if session revoked):',
            err
          );
        }
      }

      // Always clear local storage
      await Promise.all([
        SecureStore.deleteItemAsync('accessToken').catch(() => {}),
        SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
        AsyncStorage.removeItem('userData').catch(() => {}),
      ]);

      setToken(null);
      setUser(null);

      console.log('[AuthContext] Logout complete');
    } catch (error) {
      console.log('[AuthContext] Error during logout:', error);
      // Still clear state even if there's an error
      setToken(null);
      setUser(null);
    }
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
