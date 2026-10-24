import type { ReactElement } from 'react';
import { Navigate } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';
import { AuthPending } from './ProtectedRoute';
import { MfaGate } from './MfaGate';

const DEVELOPER_ROLES = ['developer', 'superAdmin'];

/**
 * Guards all /developer routes: developer and superAdmin only.
 * Frontend-only guard — the backend enforces requireDeveloper on every API call.
 */
export const DeveloperProtectedRoute = ({ children }: { children: ReactElement }) => {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);
  const authReady = useUserStore((state) => state.authReady);

  if (!authReady) return <AuthPending />;
  if (!isAuthenticated || !user) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;
  if (!DEVELOPER_ROLES.includes(user.role || '')) return <Navigate to="/profile" replace />;

  // Authenticator-app code, required by the backend for this role.
  return <MfaGate>{children}</MfaGate>;
};
