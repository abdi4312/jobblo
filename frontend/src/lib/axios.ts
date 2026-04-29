import axios from "axios";
import type {
  AxiosError,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";
import { useUserStore } from "../stores/userStore";

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshSubscribers.push(cb);
};

const onTokenRefreshed = (token: string | null) => {
  refreshSubscribers.forEach((cb) => cb(token as string));
  refreshSubscribers = [];
};

/**
 * Setup production-level interceptors for an Axios instance
 */
export const setupInterceptors = (instance: AxiosInstance) => {
  instance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
      const { tokens } = useUserStore.getState();
      const token = tokens?.accessToken;

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (config.data instanceof FormData) {
        delete config.headers["Content-Type"];
      }

      return config;
    },
    (error: AxiosError) => {
      return Promise.reject(error);
    },
  );

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & {
        _retry?: boolean;
      };

      const skipUrls = [
        "/auth/login",
        "/auth/register",
        "/auth/logout",
        "/auth/refresh-token",
      ];

      const shouldSkip = skipUrls.some((url) =>
        originalRequest.url?.includes(url),
      );
      if (shouldSkip) {
        return Promise.reject(error);
      }

      if (error.response?.status === 401 && !originalRequest._retry) {
        const errorData = error.response?.data as { code?: string };

        if (errorData?.code === "SESSION_REVOKED") {
          console.warn("[API] Session revoked. Logging out...");
          useUserStore.getState().logout();
          return Promise.reject(error);
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeTokenRefresh((token: string) => {
              if (token) {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(instance(originalRequest));
              } else {
                reject(error);
              }
            });
          });
        }

        const { tokens } = useUserStore.getState();
        if (!tokens) {
          useUserStore.getState().logout();
          return Promise.reject(error);
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          console.log("[API] Attempting token refresh...");
          const baseURL = instance.defaults.baseURL || "";

          const refreshResponse = await axios.post(
            `${baseURL}/api/auth/refresh-token`,
            {},
            { withCredentials: true },
          );

          const { accessToken } = refreshResponse.data;
          if (!accessToken) throw new Error("No access token returned");

          const { user, login } = useUserStore.getState();
          if (user) {
            login(user, { accessToken });
          }

          isRefreshing = false;
          onTokenRefreshed(accessToken);

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return instance(originalRequest);
        } catch (refreshError) {
          console.error("[API] Token refresh failed. Resetting auth state...");
          isRefreshing = false;
          onTokenRefreshed(null);

          useUserStore.getState().logout();
          return Promise.reject(refreshError);
        }
      }

      if (process.env.NODE_ENV === "development") {
        const status = error.response?.status;
        const message = (error.response?.data as any)?.message || error.message;
        console.error(`[API Error] ${status || "Network"}: ${message}`);
      }

      return Promise.reject(error);
    },
  );

  return instance;
};
