import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const ACTIVE_API_BASE_URL_KEY = 'activeApiBaseUrl';
const normalizeBaseUrl = (url) => String(url || '').replace(/\/+$/, '');

const configuredApiBaseUrl = normalizeBaseUrl(
  Constants.expoConfig?.extra?.API_BASE_URL
);
const configuredPrimaryApiBaseUrl = normalizeBaseUrl(
  Constants.expoConfig?.extra?.API_BASE_URL_PRIMARY || configuredApiBaseUrl
);
const configuredSecondaryApiBaseUrl = normalizeBaseUrl(
  Constants.expoConfig?.extra?.API_BASE_URL_SECONDARY
);
const PORT = Constants.expoConfig?.extra?.PORT || 8080;
const API_HOST = Constants.expoConfig?.extra?.API_HOST || 'localhost';
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
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
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
    if (shouldTriggerFailover(error)) {
      const originalRequest = error.config;
      await setActiveApiBaseUrl(SECONDARY_API_BASE_URL, 'primary-unreachable');

      return api.request({
        ...originalRequest,
        baseURL: activeApiBaseUrl,
        __retriedOnFailover: true,
      });
    }

    if (error.response?.status === 401) {
      // Token expired, logout user
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');
    }
    return Promise.reject(error);
  }
);
// Auth API endpoints
export const authAPI = {
  login: (email, password, role) =>
    api.post('/auth/login', { email, password, role }),
  register: (userData) => api.post('/auth/register', userData),
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

export default api;
