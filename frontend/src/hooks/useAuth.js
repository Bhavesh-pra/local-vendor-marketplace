import { useAuthContext } from '../context/AuthContext.jsx';

/**
 * Convenience hook — subscribes to AuthContext.
 * Exposes: user, token, role, isAuthenticated, setUser, clearUser.
 */
export function useAuth() {
  const { user, token, isAuthenticated, setUser, clearUser } = useAuthContext();
  return {
    user,
    token,
    role: user?.role ?? null,
    isAuthenticated,
    setUser,
    clearUser,
  };
}
