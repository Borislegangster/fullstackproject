import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

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

// ── Response interceptor: auto-refresh on 401 ────────────────
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

function processQueue(error: unknown, token: string | null = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Only attempt refresh for 401 errors that haven't already been retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't try to refresh if the failing request IS the refresh or login call
      const url = originalRequest.url || '';
      if (url.includes('/auth/refresh') || url.includes('/auth/login')) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue this request until the refresh completes
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${token}`;
          }
          return axiosClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('globus_refresh_token');
      if (!refreshToken) {
        // No refresh token available — force logout
        localStorage.removeItem('globus_token');
        localStorage.removeItem('globus_refresh_token');
        processQueue(error, null);
        isRefreshing = false;
        window.location.href = '/connexion';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = data.access_token;
        const newRefreshToken = data.refresh_token;

        localStorage.setItem('globus_token', newAccessToken);
        localStorage.setItem('globus_refresh_token', newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }

        processQueue(null, newAccessToken);
        return axiosClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed — force logout
        localStorage.removeItem('globus_token');
        localStorage.removeItem('globus_refresh_token');
        processQueue(refreshError, null);
        window.location.href = '/connexion';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Non-401 errors
    if (error.response) {
      console.error(`[API Error] ${error.response.status}:`, error.response.data);
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