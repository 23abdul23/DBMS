import axios from "axios"
import AsyncStorage from "@react-native-async-storage/async-storage"
import Constants from 'expo-constants';


const PORT = Constants.expoConfig?.extra?.PORT || 3000;
const API_HOST = Constants.expoConfig?.extra?.API_HOST || "localhost";
const API_BASE_URL = `http://${API_HOST}:${PORT}/api`;

console.log("Current URL: ", API_BASE_URL)


const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

const requestWithFallback = async (requests) => {
  let lastError

  for (const request of requests) {
    try {
      return await request()
    } catch (error) {
      lastError = error
      if (error?.response?.status !== 404) {
        throw error
      }
    }
  }

  throw lastError
}

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("authToken")
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  },
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired, logout user
      await AsyncStorage.removeItem("authToken")
      await AsyncStorage.removeItem("userData")
    }
    return Promise.reject(error)
  },
)
// Auth API endpoints
export const authAPI = {
  login: (email, password, role) => api.post("/auth/login", { email, password ,role}),
  register: (userData) => api.post("/auth/register", userData),
  refreshToken: () => api.post("/auth/refresh"),
}
// Student API endpoints
export const commonAPI = {

  getProfile: () => api.get("/auth/profile"),
  updateProfile: (data) => api.put("/auth/profile", data),
  getDailyPasskey: () => api.get("/passkey/today"),
  changePassword: (currentPassword, newPassword, confirmPassword) => {
    if (typeof currentPassword === "object" && currentPassword !== null) {
      return api.put("/student/passwordUpdate", currentPassword)
    }

    return api.put("/student/passwordUpdate", { currentPassword, newPassword, confirmPassword })
  },
  getDailyPasskeyGuard: () => api.get("/passkey/todayGuard"),
}


export const outpass = {
  getOutpasses: () => api.get("/outpass/today"),
  createOutpass: (data) => api.post("/outpass/generate", data),
  updateOutpass: (id, data) => api.put(`/outpass/${id}`, data),
  getHistory: (params) => api.get("/outpass/history", { params }),
}

export const wardenAPI = {
  getDashboard: () =>
    requestWithFallback([() => api.get("/warden/dashboard"), () => api.get("/outpass/warden/dashboard")]),
  getOutpasses: (params) =>
    requestWithFallback([
      () => api.get("/warden/outpasses", { params }),
      () => api.get("/outpass/warden/outpasses", { params }),
    ]),
  getOutpass: (id) =>
    requestWithFallback([() => api.get(`/warden/outpasses/${id}`), () => api.get(`/outpass/warden/outpasses/${id}`)]),
  actOnOutpass: (id, data) =>
    requestWithFallback([
      () => api.patch(`/warden/outpasses/${id}/action`, data),
      () => api.patch(`/outpass/warden/outpasses/${id}/action`, data),
    ]),
  getMonitoring: (params) =>
    requestWithFallback([
      () => api.get("/warden/monitoring", { params }),
      () => api.get("/outpass/warden/monitoring", { params }),
    ]),
}

// Emergency API endpoints
export const emergencyAPI = {
  createAlert: (data) => api.post("/emergency/alert", data),
  getEmergencyContacts: () => api.get("/emergency/contacts"),
}

// Security API endpoints
export const securityAPI = {
  validatePasskey: (data) => api.post("/security/validate", data),
  logEntry: (data) => api.post("/security/log", data),
  logStudentScan: (data) => api.post("/security/student-log", data),
  getLogs: (params, token) =>
    api.get("/security/logs", {
      params,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    }),
}

export default api
