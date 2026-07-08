import axiosInstance from '../lib/axios.js';

/**
 * @param {{ username: string, email: string, password: string, role?: string }} payload
 */
export async function register(payload) {
  const response = await axiosInstance.post('/register/', payload);
  return response.data;
}

/**
 * @param {{ email: string, password: string }} payload
 */
export async function login(payload) {
  const response = await axiosInstance.post('/login/', payload);
  return response.data;
}
