import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { setAuthToken } from '../lib/axios.js';
import { getItem, setItem, removeItem } from '../utils/storage.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(null);   // { userId, username, role }
  const [token, setTokenState] = useState(null);

  /**
   * Hydrate auth state from localStorage on first mount.
   * This is the ONLY time localStorage is read for auth.
   */
  useEffect(() => {
    const storedToken = getItem('token');
    const storedUser  = getItem('user');

    if (storedToken && storedUser) {
      setTokenState(storedToken);
      setUserState(storedUser);
      setAuthToken(storedToken);   // Arm the Axios interceptor
    }
  }, []);

  /**
   * Called by pages after a successful authService.login() response.
   * Updates memory, localStorage, and the Axios interceptor.
   * @param {{ userId: number, username: string, role: string, token: string }} userData
   */
  const setUser = useCallback((userData) => {
    const { token: newToken, ...userFields } = userData;
    setTokenState(newToken);
    setUserState(userFields);
    setItem('token', newToken);
    setItem('user', userFields);
    setAuthToken(newToken);
  }, []);

  /**
   * Clear auth state — purely state management, no API call.
   * Called by logout actions anywhere in the app.
   */
  const clearUser = useCallback(() => {
    setTokenState(null);
    setUserState(null);
    removeItem('token');
    removeItem('user');
    setAuthToken(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: !!token,
      setUser,
      clearUser,
    }),
    [user, token, setUser, clearUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** @returns {ReturnType<typeof useMemo>} */
export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used inside <AuthProvider>');
  return ctx;
}
