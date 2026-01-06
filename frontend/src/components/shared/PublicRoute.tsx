import { Navigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";

export const PublicRoute = ({ children }: { children: JSX.Element }) => {
  // yaha hum state ko UserState type assign kar rahe hain
  const isAuth = useUserStore((state: { isAuthenticated: boolean }) => state.isAuthenticated);

  if (isAuth) {
    return <Navigate to="/profile" replace />;
  }

  return children;
};
