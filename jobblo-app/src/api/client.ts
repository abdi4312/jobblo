import axios from 'axios';

const nativeAsyncStorage = (() => {
  try {
    const storage = require('@react-native-async-storage/async-storage');
    return storage?.default ?? storage ?? null;
  } catch {
    return null;
  }
})();

const rawBaseUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api').replace(/\/$/, '');
const baseUrl = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;
export const apiBaseUrl = baseUrl;

const webStorage = {
  async getItem(key: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  },
  async setItem(key: string, value: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  },
  async removeItem(key: string) {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  },
};

const storage = {
  getItem: async (key: string) => {
    if (nativeAsyncStorage) {
      try {
        return await nativeAsyncStorage.getItem(key);
      } catch {
        // Fall back to browser storage when native storage is unavailable in web/runtime.
      }
    }
    return webStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (nativeAsyncStorage) {
      try {
        await nativeAsyncStorage.setItem(key, value);
        return;
      } catch {
        // Fall back to browser storage when native storage is unavailable in web/runtime.
      }
    }
    await webStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (nativeAsyncStorage) {
      try {
        await nativeAsyncStorage.removeItem(key);
        return;
      } catch {
        // Fall back to browser storage when native storage is unavailable in web/runtime.
      }
    }
    await webStorage.removeItem(key);
  },
};

const apiClient = axios.create({
  baseURL: baseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401) {
      await storage.removeItem('token').catch(() => undefined);
      await storage.removeItem('user').catch(() => undefined);
    }

    return Promise.reject(error);
  }
);

export default apiClient;
