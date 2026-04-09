import axios from "axios";
import { useUserStore } from "../stores/userStore";

const mainLink = axios.create({
  baseURL: import.meta.env.VITE_MAIN_URL,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token as string));
  refreshSubscribers = [];
};

// 🔐 Bearer Token auto attach
mainLink.interceptors.request.use(
  (config) => {
    const { tokens } = useUserStore.getState();
    const token = tokens?.accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔄 Token Refresh Interceptor
mainLink.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Skip interceptor for login, register, logout, and refresh requests
    if (
      originalRequest.url?.includes("/auth/login") || 
      originalRequest.url?.includes("/auth/register") || 
      originalRequest.url?.includes("/auth/logout") || 
      originalRequest.url?.includes("/auth/refresh-token")
    ) {
      return Promise.reject(error);
    }

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorCode = error.response?.data?.code;

      // If session was revoked, logout immediately
      if (errorCode === "SESSION_REVOKED") {
        console.warn("Session revoked. Logging out...");
        useUserStore.getState().logout();
        return Promise.reject(error);
      }

      // If already refreshing, wait for it to finish
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          subscribeTokenRefresh((token: string) => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              resolve(mainLink(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      // Check if we even have tokens to refresh with
      const { tokens } = useUserStore.getState();
      if (!tokens) {
        useUserStore.getState().logout();
        return Promise.reject(error);
      }

      // Mark request as retried
      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log("Token issues detected, attempting refresh...");
        const res = await axios.post(`${import.meta.env.VITE_MAIN_URL}/api/auth/refresh-token`, {}, { withCredentials: true });
        
        const { accessToken } = res.data;
        if (!accessToken) throw new Error("No access token returned");

        const { user, login } = useUserStore.getState();
        if (user) {
          login(user, { accessToken });
        }

        isRefreshing = false;
        onTokenRefreshed(accessToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return mainLink(originalRequest);
      } catch (refreshError: unknown) {
        console.error("Token refresh failed. Resetting auth state...");
        isRefreshing = false;
        onTokenRefreshed(null); // Notify subscribers that it failed
        
        // Clear auth state on total failure
        useUserStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default mainLink;
