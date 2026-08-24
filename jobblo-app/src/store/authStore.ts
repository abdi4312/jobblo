import { create } from 'zustand';
import { queryClient } from '../providers/AppProviders';
import { destroyChatSocket } from '../services/chatSocket.service';
import { deactivateRegisteredPushToken } from '../services/pushNotifications.service';

type AuthUser = Record<string, unknown> | null;

function userId(user: AuthUser) {
  return user && typeof user._id === 'string' ? user._id : null;
}

async function clearAuthenticatedSession() {
  await deactivateRegisteredPushToken().catch(() => undefined);
  await queryClient.cancelQueries();
  queryClient.removeQueries();
  destroyChatSocket();
}

const nativeAsyncStorage = (() => {
  try {
    const storage = require('@react-native-async-storage/async-storage');
    return storage?.default ?? storage ?? null;
  } catch {
    return null;
  }
})();

const getWebStorage = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    return {
      getItem: (key: string) => Promise.resolve(window.localStorage.getItem(key)),
      setItem: (key: string, value: string) => Promise.resolve(window.localStorage.setItem(key, value)),
      removeItem: (key: string) => Promise.resolve(window.localStorage.removeItem(key)),
    };
  }

  return {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  };
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
    return getWebStorage().getItem(key);
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
    await getWebStorage().setItem(key, value);
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
    await getWebStorage().removeItem(key);
  },
};

type AuthState = {
  token: string | null;
  user: AuthUser;
  isAuthenticated: boolean;
  hydrate: () => Promise<void>;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Record<string, unknown>) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,

  hydrate: async () => {
    try {
      const [token, user] = await Promise.all([
        storage.getItem('token'),
        storage.getItem('user'),
      ]);

      if (!token) {
        set({ token: null, user: null, isAuthenticated: false });
        return;
      }

      set({
        token,
        user: user ? JSON.parse(user) : null,
        isAuthenticated: true,
      });
    } catch (error) {
      console.warn('Unable to hydrate auth state', error);
      set({ token: null, user: null, isAuthenticated: false });
    }
  },

  login: async (token, user) => {
    if (userId(get().user) && userId(get().user) !== userId(user)) {
      await clearAuthenticatedSession();
    }
    await Promise.all([
      storage.setItem('token', token),
      storage.setItem('user', JSON.stringify(user)),
    ]);

    set({ token, user, isAuthenticated: true });
  },

  logout: async () => {
    await clearAuthenticatedSession();
    await storage.removeItem('token');
    await storage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  updateUser: async (patch) => {
    const currentUser = get().user ?? {};
    const nextUser = { ...currentUser, ...patch };

    await storage.setItem('user', JSON.stringify(nextUser));
    set({ user: nextUser });
  },
}));

export type { AuthUser };
