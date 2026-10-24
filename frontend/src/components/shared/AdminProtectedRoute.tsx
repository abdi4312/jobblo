import { Navigate } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';
import { AuthPending } from './ProtectedRoute';
import { MfaGate } from './MfaGate';

/**
 * Guards all /dashboard routes.
 * Only users with role === 'superAdmin' may access the admin panel.
 * Frontend-only guard — backend enforces requireAdmin on every API call.
 *
 * `user` comes from the server (/api/auth/profile after the refresh-cookie bootstrap),
 * never from localStorage, so editing a stored role no longer opens this UI.
 */
export const AdminProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const authReady = useUserStore((state) => state.authReady);

  if (!authReady) return <AuthPending />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'superAdmin') {
    return <Navigate to="/profile" replace />;
  }

  // Authenticator-app code, required by the backend for this role.
  return <MfaGate>{children}</MfaGate>;
};
