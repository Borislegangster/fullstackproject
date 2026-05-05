import axios from 'axios';

const envVars = typeof import.meta !== 'undefined' && import.meta.env || {};
const API_BASE_URL = envVars.VITE_API_URL ?
`${envVars.VITE_API_URL}/api/v1` :
'';

export const axiosClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// ── Request interceptor: attach Authorization header ─────────
axiosClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('globus_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: normalize errors ───────────────────
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;
      if (status === 401) {
        localStorage.removeItem('globus_token');
        // Optionally redirect to login
      }
      console.error(`[API Error] ${status}:`, error.response.data);
    } else if (error.request) {
      console.error('[API Error] No response received:', error.message);
    } else {
      console.error('[API Error]', error.message);
    }
    return Promise.reject(error);
  }
);

/** Helper: returns true when a real API backend is configured */
export function isApiConfigured(): boolean {
  return Boolean(envVars.VITE_API_URL);
}