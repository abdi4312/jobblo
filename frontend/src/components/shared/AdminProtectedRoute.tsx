import { Navigate } from "react-router-dom";
import { useUserStore } from "../../stores/userStore";

export const AdminProtectedRoute = ({
  children,
}: {
  children: JSX.Element;
}) => {
  const user = useUserStore((state) => state.user);
  
  // Debugging ke liye
  console.log("Current User:", user);

  // 1. Agar user login hi nahi hai, to login page par bhejo
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // 2. Agar user admin NAHI hai, to profile ya home par bhejo
  if (user.role !== "superAdmin") {
    return <Navigate to="/profile" replace />;
  }

  // 3. Agar user admin hai, to children (Admin Page) dikhao
  return children;
};