import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { userLogin, registerUser, logoutUser, getUserSessions, revokeSession, revokeAllOtherSessions, fetchProfile, refreshToken } from "../Api";
import { useUserStore } from "../../../stores/userStore";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";

export const useAuth = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { login: setStoreLogin, logout: setStoreLogout, isAuthenticated } = useUserStore();

  // Note: Don't auto-logout here during rehydration - let the interceptor handle token issues

  const loginMutation = useMutation({
    mutationFn: userLogin,
    onSuccess: (data) => {
      setStoreLogin(data.user, { accessToken: data.accessToken });
      queryClient.setQueryData(["profile"], data.user);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success(`Velkommen tilbake, ${data.user.name}!`);
      navigate("/home");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      console.error("Login Error Details:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Innlogging mislyktes. Vennligst sjekk legitimasjonen din.";
      console.log("errorMessage",errorMessage);
      
      toast.error(errorMessage);
    },
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: (data) => {
      setStoreLogin(data.user, { accessToken: data.accessToken });
      queryClient.setQueryData(["profile"], data.user);
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Registration Successful!");
      navigate("/home");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string; message?: string } }; message?: string };
      console.error("Registration Error Details:", err.response?.data || err.message);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || "Registrering mislyktes.";
      toast.error(errorMessage);
    },
  });

  const logoutMutation = useMutation({
    mutationFn: logoutUser,
    onSuccess: () => {
      setStoreLogout();
      queryClient.clear();
      toast.success("Logged out successfully");
      navigate("/login");
    },
    onError: () => {
      // Still logout locally if server logout fails
      setStoreLogout();
      queryClient.clear();
      navigate("/login");
    },
  });

  const profileQuery = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const userData = await fetchProfile();
      useUserStore.getState().setUser(userData);
      return userData;
    },
    retry: false,
    enabled: isAuthenticated, // Use isAuthenticated instead of tokens?.accessToken
  });

  const sessionsQuery = useQuery({
    queryKey: ["sessions"],
    queryFn: getUserSessions,
    enabled: isAuthenticated,
    retry: false,
  });

  const revokeSessionMutation = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session revoked");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to revoke session");
    },
  });

  const revokeOthersMutation = useMutation({
    mutationFn: revokeAllOtherSessions,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("All other sessions revoked");
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to revoke other sessions");
    },
  });

  // Proactive Token Refresh (Keep session alive)
  useQuery({
    queryKey: ["auth-refresh"],
    queryFn: async () => {
      try {
        const data = await refreshToken();
        useUserStore.getState().setTokens({ accessToken: data.accessToken });
        return data;
      } catch (error) {
        console.error("Proactive token refresh failed:", error);
        // Don't logout here - let the interceptor handle it on next API call
        throw error;
      }
    },
    refetchInterval: 1000 * 60 * 45, // Proactively refresh every 45 minutes
    enabled: isAuthenticated,
    retry: 2,
  });

  return {
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    register: registerMutation.mutate,
    isRegistering: registerMutation.isPending,
    registerError: registerMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    user: profileQuery.data,
    isLoadingUser: profileQuery.isLoading,
    sessions: sessionsQuery.data,
    isLoadingSessions: sessionsQuery.isLoading,
    revokeSession: revokeSessionMutation.mutate,
    revokeOthers: revokeOthersMutation.mutate,
    isRevokingOthers: revokeOthersMutation.isPending,
  };
};
