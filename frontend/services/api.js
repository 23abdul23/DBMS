import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { emitLogout } from '../utils/logoutEventEmitter';
import { createLogger, sanitizeForLogs, serializeError } from '../utils/logger';

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

export const isDevelopmentEnvironement = appEnvironement === 'development';

const apiLogger = createLogger('api', 'API');

const sanitizeUrl = (baseUrl, url) => {
  const fullUrl = `${baseUrl || ''}${url || ''}`;
  return fullUrl.replace(/([?&](token|refreshToken|password|email)=)[^&]*/gi, '$1[redacted]');
};

const buildApiLogContext = (config = {}) => ({
  method: String(config.method || 'get').toUpperCase(),
  url: sanitizeUrl(config.baseURL || activeApiBaseUrl, config.url),
  timeout: config.timeout,
  hasAuth: Boolean(config.headers?.Authorization),
  params: sanitizeForLogs(config.params),
  body: sanitizeForLogs(config.data),
});

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
      apiLogger.warn('failed-to-persist-base-url', serializeError(storageError));
  }

  apiLogger.info('api-base-url-switched', { baseUrl, reason });
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
    apiLogger.warn('failed-to-restore-base-url', serializeError(storageError));
  }
};

apiLogger.info('api-config', {
  environment: appEnvironement || 'unknown',
  primaryBaseUrl: PRIMARY_API_BASE_URL,
  secondaryBaseUrl: SECONDARY_API_BASE_URL || null,
  failoverEnabled: canFailover,
});

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
    // attach timing + auth
    try {
      config._startTime = Date.now();
      const accessToken = await SecureStore.getItemAsync('accessToken');
      if (accessToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      apiLogger.debug('request-start', {
        ...buildApiLogContext(config),
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      apiLogger.warn('request-interceptor-log-failed', serializeError(e));
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    try {
      const start = response.config?._startTime;
      const duration = start ? Date.now() - start : null;
      apiLogger.debug('response-received', {
        method: String(response.config?.method || 'get').toUpperCase(),
        url: sanitizeUrl(
          response.config?.baseURL || activeApiBaseUrl,
          response.config?.url
        ),
        status: response.status,
        durationMs: duration,
      });
    } catch {
      // ignore logging failures
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const errorCode = error.response?.data?.code;
    const errorMessage = error.response?.data?.message;

    try {
      const duration = originalRequest?._startTime
        ? Date.now() - originalRequest._startTime
        : null;
      apiLogger.warn('request-error', {
        method: String(originalRequest?.method || 'get').toUpperCase(),
        url: sanitizeUrl(
          originalRequest?.baseURL || activeApiBaseUrl,
          originalRequest?.url
        ),
        status: error.response?.status,
        code: errorCode,
        message: errorMessage,
        durationMs: duration,
        retried: !!originalRequest?._retry,
      });
    } catch (e) {
      apiLogger.warn('response-error-log-failed', serializeError(e));
    }

    // If already retried or not a 401, don't retry
    if (originalRequest?._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    // SESSION_REVOKED means user logged in elsewhere - force logout immediately
    if (errorCode === 'SESSION_REVOKED' || errorCode === 'USER_DISABLED') {
      apiLogger.warn('session-revoked', {
        code: errorCode,
        message: errorMessage,
      });
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
      if (!originalRequest) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');

        if (!refreshToken) {
          apiLogger.warn('no-refresh-token', {
            message: 'No refresh token available - logging out',
          });
          await emitLogout('NO_REFRESH_TOKEN');
          return Promise.reject(error);
        }

        apiLogger.debug('token-refresh-attempt', {
          url: `${PRIMARY_API_BASE_URL}/auth/refresh`,
        });
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
          apiLogger.warn('refresh-session-revoked', { responseCode });
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

        apiLogger.info('token-refreshed-success');

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        apiLogger.warn('token-refresh-failed', {
          error: serializeError(refreshError),
        });

        const refreshErrorCode = refreshError.response?.data?.code;

        // All refresh errors should trigger logout
        if (
          refreshErrorCode === 'SESSION_REVOKED' ||
          refreshErrorCode === 'TOKEN_EXPIRED' ||
          refreshErrorCode === 'USER_DISABLED' ||
          refreshError.response?.status === 401
        ) {
          apiLogger.warn('refresh-error-triggered-logout', {
            refreshErrorCode,
          });
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

export const notificationAPI = {
  saveToken: (data) => api.post('/notifications/token', data),
  deactivateToken: (data) => api.post('/notifications/token/deactivate', data),
  list: (params = {}) => api.get('/notifications', { params }),
  unreadCount: () => api.get('/notifications/unread-count'),
  markRead: (id) => api.patch(`/notifications/${id}/read`),
  testHelloNotification: (studentId) =>
    api.post('/notifications/test-hello', { studentId }),
  adminOverview: () => api.get('/notifications/admin/overview'),
  adminTokens: (params = {}) =>
    api.get('/notifications/admin/tokens', { params }),
  adminDeliveries: (params = {}) =>
    api.get('/notifications/admin/deliveries', { params }),
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
  selectRoom: (roomName, data = {}) =>
    api.post(`/sac/rooms/${encodeURIComponent(roomName)}/select`, data),
  leaveRoom: (roomName) =>
    api.post(`/sac/rooms/${encodeURIComponent(roomName)}/leave`),
  selectEquipment: (equipmentName, data = {}) =>
    api.post(
      `/sac/equipment/${encodeURIComponent(equipmentName)}/select`,
      data
    ),
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

export const locationAPI = {
  getActive: () => api.get('/locations/active'),
};

export const adminAPI = {
  getAllUsersByRole: (role) =>
    api.get('/admin/users-by-role', { params: { role } }),
};

export default api;
