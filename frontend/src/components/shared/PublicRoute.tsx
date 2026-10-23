import { Navigate, useLocation } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';
import { AuthPending } from './ProtectedRoute';

export const PublicRoute = ({ children }: { children: JSX.Element }) => {
  const isAuth = useUserStore((state) => state.isAuthenticated);
  const authReady = useUserStore((state) => state.authReady);
  const location = useLocation();

  // Wait for the session bootstrap, or a signed-in user sees the login form flash.
  if (!authReady) return <AuthPending />;

  if (isAuth) {
    // Honour the destination ProtectedRoute stashed, so an already-authenticated
    // user who lands on /login (e.g. via a stale link) still ends up where they
    // were headed instead of being dumped on /home.
    const from = (location.state as { from?: unknown } | null)?.from;
    const target =
      typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/home';
    return <Navigate to={target} replace />;
  }

  return children;
};
