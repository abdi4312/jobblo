import axios, { type InternalAxiosRequestConfig } from 'axios';
import { authStorage as storage } from '../utils/authStorage';

/**
 * Opt out of this client's session handling for one request.
 *
 * Set it when the caller is presenting a bearer token that is NOT the stored session — the
 * OAuth hand-off verifying a freshly minted token against `/auth/profile` before anybody is
 * signed in. Three things change for such a request: the interceptor leaves the caller's
 * `Authorization` header alone instead of overwriting it from storage, a 401 does not try to
 * refresh (there is no session to refresh), and a 401 does not tear down the session (a
 * rejected hand-off token must not sign out whoever is already using the app).
 */
declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  export interface AxiosRequestConfig {
    _callerSuppliedAuth?: boolean;
  }
}

const rawBaseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
const baseUrl = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
export const apiBaseUrl = baseUrl;

const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  // The caller brought its own credential; overwriting it from storage would send the old
  // session's token to an endpoint that was asked to check a different one.
  if (config._callerSuppliedAuth) return config;

  try {
    const token = await storage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (error) {
    console.warn('Unable to attach auth token:', error);
  }

  return config;
});

/**
 * Silent access-token refresh.
 *
 * The backend issues a 1-hour access token and a 7-day refresh token
 * (`backend/utils/tokenUtils.js`). The refresh token is delivered ONLY as an httpOnly
 * cookie, and `POST /api/auth/refresh-token` reads it only from `req.cookies.refreshToken`, so
 * JS can never hold it. What makes a client-side refresh possible anyway is that the
 * cookie is persistent (`maxAge` 7 days), so React Native's native cookie store keeps
 * sending it across JS reloads.
 *
 * Without this, every 401 was terminal: reloading the app more than an hour after login
 * hit `TOKEN_EXPIRED` on the first request and the user was logged straight back out.
 */
const AUTH_PATHS_WITHOUT_REFRESH = [
  '/auth/login',
  '/auth/register',
  '/auth/refresh-token',
  '/auth/logout',
];

function isAuthEndpoint(url?: string) {
  return !!url && AUTH_PATHS_WITHOUT_REFRESH.some((path) => url.includes(path));
}

async function requestNewAccessToken(): Promise<string | null> {
  try {
    // Bare axios rather than `apiClient`: routing this through our own interceptors
    // would let a failing refresh recurse into itself.
    const response = await axios.post<{ accessToken?: string }>(
      // `/auth/refresh-token` is the route the backend actually registers
      // (`backend/routes/auth.js`), and the one the web client uses. Asking for
      // `/auth/refresh` returned 404, so every expired access token ended the session.
      `${baseUrl}/auth/refresh-token`,
      {},
      { withCredentials: true, timeout: 15000 }
    );

    const token = response.data?.accessToken;
    if (typeof token !== 'string' || !token) return null;

    await storage.setItem('token', token);
    try {
      // Lazy require avoids a circular import at module load time.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('../store/authStore') as typeof import('../store/authStore');
      useAuthStore.setState({ token, isAuthenticated: true });
    } catch {
      // Storage is what the request interceptor actually reads, so a missing store
      // costs consistency, not the session.
    }
    return token;
  } catch {
    return null;
  }
}

/** One refresh at a time, shared by every request that got a 401 in the same window. */
let refreshInFlight: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = requestNewAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

let teardownInFlight: Promise<void> | null = null;

async function handleAuthFailure() {
  if (teardownInFlight) return teardownInFlight;
  teardownInFlight = (async () => {
    try {
      // Lazy require avoids circular import at module load time.
      // chatSocket.service uses the same pattern for authStore.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useAuthStore } = require('../store/authStore') as typeof import('../store/authStore');
      await useAuthStore.getState().logout();
    } catch {
      // If the store is unavailable (should not happen), at minimum clear
      // persisted credentials so the next cold start lands on the login screen.
      await storage.removeItem('token').catch(() => undefined);
      await storage.removeItem('user').catch(() => undefined);
    }
    // Reset so a later session can be torn down too, instead of this being a
    // one-shot guard for the lifetime of the JS context.
  })().finally(() => {
    teardownInFlight = null;
  });
  return teardownInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _retriedAfterRefresh?: boolean };

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status !== 401) return Promise.reject(error);

    const config = error.config as RetriableConfig | undefined;

    /**
     * A token the caller supplied itself was refused. That is an answer, not a dead session:
     * the OAuth hand-off asks this question precisely so it can reject a bad token. There is
     * nothing to refresh — the refresh cookie belongs to whatever session the device already
     * has, and using it here would sign the *previous* account back in — and nothing to tear
     * down, because a rejected hand-off must not log out whoever is currently signed in.
     */
    if (config?._callerSuppliedAuth) return Promise.reject(error);

    // A 401 from login/register is wrong credentials, not a dead session. Tearing the
    // session down here would also wipe a signed-in user who mistyped on a re-auth.
    if (isAuthEndpoint(config?.url)) return Promise.reject(error);

    // Already retried once with a fresh token and still refused: the session is gone.
    if (!config || config._retriedAfterRefresh) {
      void handleAuthFailure();
      return Promise.reject(error);
    }

    // Only refresh when the request actually presented a token. A 401 on a request
    // that carried no Authorization header means we are already signed out — and the
    // native cookie store can still hold a valid refresh cookie from the previous
    // session, so refreshing here would silently sign the old account back in.
    if (!config.headers?.Authorization) {
      void handleAuthFailure();
      return Promise.reject(error);
    }

    const token = await refreshAccessToken();
    if (!token) {
      void handleAuthFailure();
      return Promise.reject(error);
    }

    config._retriedAfterRefresh = true;
    if (config.headers) config.headers.Authorization = `Bearer ${token}`;
    return apiClient(config);
  }
);

export default apiClient;
