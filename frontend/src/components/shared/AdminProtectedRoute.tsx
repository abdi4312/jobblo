import { Navigate } from 'react-router-dom';
import { useUserStore } from '../../stores/userStore';

/**
 * Guards all /dashboard routes.
 * Only users with role === 'superAdmin' may access the admin panel.
 * Frontend-only guard — backend enforces requireAdmin on every API call.
 */
export const AdminProtectedRoute = ({ children }: { children: JSX.Element }) => {
  const user = useUserStore((state) => state.user);
  const isAuthenticated = useUserStore((state) => state.isAuthenticated);

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'superAdmin') {
    return <Navigate to="/profile" replace />;
  }

  return children;
};
