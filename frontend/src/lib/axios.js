/**
 * lib/axios.js — Infrastructure layer
 *
 * Exports the configured Axios instance and a setAuthToken() function.
 * This is the ONLY file that creates or configures an Axios instance.
 *
 * Token flow:
 *  - AuthContext calls setAuthToken(token) after login / hydration.
 *  - AuthContext calls setAuthToken(null) on logout.
 *  - The request interceptor reads the module-level variable — never localStorage.
 *  - localStorage is only read once at app startup (in AuthContext.initFromStorage).
 */

import axios from 'axios';
import { removeItem } from '../utils/storage.js';

/** Module-level token — runtime source of truth. */
let authToken = null;

/**
 * Update the in-memory auth token.
 * Called by AuthContext; never called by services or components.
 * @param {string|null} token
 */
export function setAuthToken(token) {
  authToken = token ?? null;
}

/** Configured Axios instance */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/** Request interceptor — attach Bearer token from memory */
axiosInstance.interceptors.request.use(
  (config) => {
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/** Response interceptor — handle 401 globally */
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear persisted token on authentication failure.
      // AuthContext state reset is the page/component's responsibility.
      setAuthToken(null);
      removeItem('token');
      removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
