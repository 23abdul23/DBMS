import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { emitLogout } from '../utils/logoutEventEmitter';

const ACTIVE_API_BASE_URL_KEY = 'activeApiBaseUrl';
const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '');

const expoExtra =
  Constants.expoConfig?.extra ??
  Constants.manifest?.extra ??
  Constants.manifest2?.extra ??
  {};

const configuredApiBaseUrl = normalizeBaseUrl(expoExtra.API_BASE_URL);
const configuredPrimaryApiBaseUrl = normalizeBaseUrl(
  expoExtra.API_BASE_URL_PRIMARY || configuredApiBaseUrl
);
const configuredSecondaryApiBaseUrl = normalizeBaseUrl(
  expoExtra.API_BASE_URL_SECONDARY
);
const appEnvironement = String(
  expoExtra.ENVIRONMENT || expoExtra.ENVIRONEMENT || ''
)
  .trim()
  .toLowerCase();

console.log(appEnvironement);

export const isDevelopmentEnvironement = appEnvironement === 'development';

export const devQuickLoginCredentialsByRole = {
  student: {
    email: 'iit2023001@iiita.ac.in',
    password: '123456',
  },
  warden: {
    email: 'warden.bh-1@iiita.ac.in',
    password: '123456',
  },
  security: {
    email: 'guard100@iiita.ac.in',
    password: '123456',
  },
  sac_admin: {
    email: 'sacAdmin@iiita.ac.in',
    password: '123456',
  },
  library_admin: {
    email: 'libAdmin@iiita.ac.in',
    password: '123456',
  },
};

const PORT = expoExtra.PORT;
const API_HOST = expoExtra.API_HOST;

const fallbackLocalBaseUrl = `http://${API_HOST}:${PORT}/api`;
const PRIMARY_API_BASE_URL =
  configuredPrimaryApiBaseUrl || fallbackLocalBaseUrl;
const SECONDARY_API_BASE_URL = configuredSecondaryApiBaseUrl;
const API_BASE_URL = PRIMARY_API_BASE_URL;

let activeApiBaseUrl = API_BASE_URL;

const apiBaseUrlOptions = [PRIMARY_API_BASE_URL, SECONDARY_API_BASE_URL].filter(
  Boolean
);
const canFailover =
  Boolean(SECONDARY_API_BASE_URL) &&
  normalizeBaseUrl(PRIMARY_API_BASE_URL) !==
    normalizeBaseUrl(SECONDARY_API_BASE_URL);

const setActiveApiBaseUrl = async (baseUrl, reason = 'manual') => {
  if (!baseUrl || activeApiBaseUrl === baseUrl) {
    return;
  }

  activeApiBaseUrl = baseUrl;
  api.defaults.baseURL = baseUrl;

  try {
    await AsyncStorage.setItem(ACTIVE_API_BASE_URL_KEY, baseUrl);
  } catch (storageError) {
    console.warn(
      'Failed to persist API base URL:',
      storageError?.message || storageError
    );
  }

  console.log(`API switched to ${baseUrl} (${reason})`);
};

const restoreActiveApiBaseUrl = async () => {
  try {
    const persistedBaseUrl = normalizeBaseUrl(
      await AsyncStorage.getItem(ACTIVE_API_BASE_URL_KEY)
    );
    if (!persistedBaseUrl) {
      return;
    }

    if (apiBaseUrlOptions.includes(persistedBaseUrl)) {
      await setActiveApiBaseUrl(persistedBaseUrl, 'restore');
    }
  } catch (storageError) {
    console.warn(
      'Failed to restore API base URL:',
      storageError?.message || storageError
    );
  }
};

const shouldTriggerFailover = (error) => {
  if (!canFailover) {
    return false;
  }

  if (
    normalizeBaseUrl(activeApiBaseUrl) ===
    normalizeBaseUrl(SECONDARY_API_BASE_URL)
  ) {
    return false;
  }

  const originalRequest = error?.config;
  if (!originalRequest || originalRequest.__retriedOnFailover) {
    return false;
  }

  if (error?.code === 'ECONNABORTED') {
    return true;
  }

  if (!error?.response) {
    return true;
  }

  const status = error.response.status;
  return [500, 502, 503, 504].includes(status);
};

console.log('Primary API URL:', PRIMARY_API_BASE_URL);

if (SECONDARY_API_BASE_URL) {
  console.log('Secondary API URL:', SECONDARY_API_BASE_URL);
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

restoreActiveApiBaseUrl();

const requestWithFallback = async (requests) => {
  let lastError;

  for (const request of requests) {
    try {
      return await request();
    } catch (error) {
      lastError = error;
      if (error?.response?.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError;
};

const allowOpenClosedStatus = (status) => status === 200 || status === 403;

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const accessToken = await SecureStore.getItemAsync('accessToken');

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.message;

    console.log('[API Error]', {
      code: errorCode,
      message: errorMessage,
      status: error.response?.status,
      retried: !!originalRequest._retry,
    });

    // If already retried or not a 401, don't retry
    if (originalRequest._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // SESSION_REVOKED means user logged in elsewhere - force logout immediately
    if (errorCode === 'SESSION_REVOKED' || errorCode === 'USER_DISABLED') {
      console.log('[API] Session revoked - forcing logout');
      await Promise.all([
        SecureStore.deleteItemAsync('accessToken').catch(() => {}),
        SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
        AsyncStorage.removeItem('userData').catch(() => {}),
      ]);

      // Emit logout event to notify AuthContext
      await emitLogout(errorCode);

      return Promise.reject(error);
    }

    // TOKEN_EXPIRED or TOKEN needs refresh
    if (errorCode === 'TOKEN_EXPIRED' || error.response?.status === 401) {
      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');

        if (!refreshToken) {
          console.log('[API] No refresh token available - logging out');
          await emitLogout('NO_REFRESH_TOKEN');
          return Promise.reject(error);
        }

        console.log('[API] Attempting token refresh...');
        const response = await axios.post(
          `${PRIMARY_API_BASE_URL}/auth/refresh`,
          { refreshToken },
          {
            // Important: don't use our api instance here to avoid interceptor loops
            timeout: 10000,
          }
        );

        const {
          accessToken,
          refreshToken: newRefreshToken,
          code: responseCode,
        } = response.data;

        // Check if refresh was successful
        if (responseCode === 'SESSION_REVOKED' || !accessToken) {
          console.log('[API] Refresh returned SESSION_REVOKED');
          await Promise.all([
            SecureStore.deleteItemAsync('accessToken').catch(() => {}),
            SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
            AsyncStorage.removeItem('userData').catch(() => {}),
          ]);
          await emitLogout('SESSION_REVOKED');
          return Promise.reject(error);
        }

        // Save new tokens
        await SecureStore.setItemAsync('accessToken', accessToken);
        if (newRefreshToken) {
          await SecureStore.setItemAsync('refreshToken', newRefreshToken);
        }

        console.log('[API] Token refreshed successfully');

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error(
          '[API] Token refresh failed:',
          refreshError.response?.data
        );

        const refreshErrorCode = refreshError.response?.data?.code;

        // All refresh errors should trigger logout
        if (
          refreshErrorCode === 'SESSION_REVOKED' ||
          refreshErrorCode === 'TOKEN_EXPIRED' ||
          refreshErrorCode === 'USER_DISABLED' ||
          refreshError.response?.status === 401
        ) {
          console.log(
            '[API] Refresh error indicates session revoked - logging out'
          );
          await Promise.all([
            SecureStore.deleteItemAsync('accessToken').catch(() => {}),
            SecureStore.deleteItemAsync('refreshToken').catch(() => {}),
            AsyncStorage.removeItem('userData').catch(() => {}),
          ]);
          await emitLogout(refreshErrorCode || 'REFRESH_FAILED');
        }

        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API endpoints
export const authAPI = {
  login: (email, password, role) =>
    api.post('/auth/login', { email, password, role }),
  register: (userData) => api.post('/auth/register', userData),
  logout: () => api.post('/auth/logout'),
  refreshToken: () => api.post('/auth/refresh'),
};
// Student API endpoints
export const commonAPI = {
  getProfile: () => api.get('/auth/profile'),
  updateProfile: (data) => api.put('/auth/profile', data),
  changePassword: (currentPassword, newPassword, confirmPassword) => {
    if (typeof currentPassword === 'object' && currentPassword !== null) {
      return api.put('/student/passwordUpdate', currentPassword);
    }

    return api.put('/student/passwordUpdate', {
      currentPassword,
      newPassword,
      confirmPassword,
    });
  },
  requestPasswordOtp: (data) =>
    api.post('/student/password-update/request-otp', data),
  verifyPasswordOtp: (data) =>
    api.post('/student/password-update/verify-otp', data),
};

export const studentAPI = {
  getLogs: (params = {}) => api.get('/student/logs', { params }),
};

export const outpass = {
  getOutpasses: () => api.get('/outpass/today'),
  createOutpass: (data) => api.post('/outpass/generate', data),
  updateOutpass: (id, data) => api.put(`/outpass/${id}`, data),
  getHistory: (params) => api.get('/outpass/history', { params }),
};

export const wardenAPI = {
  getDashboard: () =>
    requestWithFallback([
      () => api.get('/warden/dashboard'),
      () => api.get('/outpass/warden/dashboard'),
    ]),
  getOutpasses: (params) =>
    requestWithFallback([
      () => api.get('/warden/outpasses', { params }),
      () => api.get('/outpass/warden/outpasses', { params }),
    ]),
  getOutpass: (id) =>
    requestWithFallback([
      () => api.get(`/warden/outpasses/${id}`),
      () => api.get(`/outpass/warden/outpasses/${id}`),
    ]),
  actOnOutpass: (id, data) =>
    requestWithFallback([
      () => api.patch(`/warden/outpasses/${id}/action`, data),
      () => api.patch(`/outpass/warden/outpasses/${id}/action`, data),
    ]),
  getMonitoring: (params) =>
    requestWithFallback([
      () => api.get('/warden/monitoring', { params }),
      () => api.get('/outpass/warden/monitoring', { params }),
    ]),
};

// Emergency API endpoints
export const emergencyAPI = {
  createAlert: (data) => api.post('/emergency/alert', data),
  getEmergencyContacts: () => api.get('/emergency/contacts'),
};

// Security API endpoints
export const securityAPI = {
  logEntry: (data) => api.post('/security/log', data),
  logStudentScan: (data) => api.post('/security/student-log', data),
  getLogs: (params = {}, token) =>
    api.get('/security/logs', {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
};

export const sacAPI = {
  getOverview: () => api.get('/sac/overview'),
  getSacStatus: () =>
    api.get('/sac/status', { validateStatus: allowOpenClosedStatus }),
  selectRoom: (roomName) =>
    api.post(`/sac/rooms/${encodeURIComponent(roomName)}/select`),
  leaveRoom: (roomName) =>
    api.post(`/sac/rooms/${encodeURIComponent(roomName)}/leave`),
  selectEquipment: (equipmentName) =>
    api.post(`/sac/equipment/${encodeURIComponent(equipmentName)}/select`),
  returnEquipment: (equipmentName, data = {}) =>
    api.post(
      `/sac/equipment/${encodeURIComponent(equipmentName)}/return`,
      data
    ),
};

export const libraryAPI = {
  getOverview: () => api.get('/library/overview'),
  getStatus: () =>
    api.get('/library/status', { validateStatus: allowOpenClosedStatus }),
  claimSeat: (seatNumber) => api.post('/library/claim-seat', { seatNumber }),
  releaseSeat: () => api.post('/library/release-seat'),
  adminReleaseSeat: (data = {}) =>
    api.post('/library/admin/release-seat', data),
};

export const securityAdminAPI = {
  // Location endpoints
  getLocations: (type, isActive) =>
    api.get('/security-admin/locations', {
      params: {
        ...(type && { type }),
        ...(isActive !== undefined && { isActive }),
      },
    }),
  getLocation: (id) => api.get(`/security-admin/locations/${id}`),
  createLocation: (data) => api.post('/security-admin/locations', data),
  updateLocation: (id, data) =>
    api.put(`/security-admin/locations/${id}`, data),
  deleteLocation: (id) => api.delete(`/security-admin/locations/${id}`),

  // QR endpoints
  generateQR: (locationId, format = 'PNG') =>
    api.post(`/security-admin/qr/location/${locationId}/generate`, { format }),
  getLocationQR: (locationId) =>
    api.get(`/security-admin/qr/location/${locationId}`),
  recordDownload: (locationId, fileName, fileSize) =>
    api.post(`/security-admin/qr/location/${locationId}/download`, {
      fileName,
      fileSize,
    }),

  // History endpoints
  getDownloadHistory: (locationId, limit = 50, offset = 0) =>
    api.get('/security-admin/qr/download-history', {
      params: { ...(locationId && { locationId }), limit, offset },
    }),
  getGenerationHistory: (locationId, limit = 50, offset = 0) =>
    api.get('/security-admin/qr/generation-history', {
      params: { ...(locationId && { locationId }), limit, offset },
    }),

  // Statistics
  getQRStatistics: () => api.get('/security-admin/statistics/qr'),
};

export default api;
