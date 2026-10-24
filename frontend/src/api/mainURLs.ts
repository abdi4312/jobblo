import axios from 'axios';
import { setupInterceptors } from '../lib/axios';
import { API_BASE_URL } from '../config/env';
import { trackApi } from '../lib/rum';

const BASE_URL = API_BASE_URL;

/**
 * Main Axios instance for the application.
 * Setup with production-level interceptors (Auth, Refresh Token, etc.)
 */
const mainLink = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// interceptors from lib/axios (includes normalization of API errors)
setupInterceptors(mainLink);

// Session diagnostics (lib/rum.ts): time every call; 5xx and network failures are reported.
type Timed = { __startedAt?: number };
mainLink.interceptors.request.use((config) => Object.assign(config, { __startedAt: Date.now() }));
const timing = (config: unknown, status: number) => {
  const c = config as (Timed & { method?: string; url?: string }) | undefined;
  if (c?.__startedAt) trackApi(c.method, c.url, status, Date.now() - c.__startedAt);
};

// Response interceptor that maps known error shape to simpler form (redundant but safe)
mainLink.interceptors.response.use((r) => {
  timing(r.config, r.status);
  return r;
}, (err) => {
  timing(err?.config, err?.response?.status ?? 0);
  const data = err?.response?.data;
  if (data && data.error) {
    err.apiError = data.error;
  }
  return Promise.reject(err);
});

export default mainLink;
