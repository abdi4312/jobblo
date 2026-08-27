import { create } from 'zustand';
import { queryClient } from '../providers/queryClient';
import { destroyChatSocket } from '../services/chatSocket.service';
import { deactivateRegisteredPushToken } from '../services/pushNotifications.service';
import { authStorage as storage } from '../utils/authStorage';

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

type AuthState = {
  token: string | null;
  user: AuthUser;
  isAuthenticated: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  login: (token: string, user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Record<string, unknown>) => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  hydrated: false,

  hydrate: async () => {
    try {
      const [token, user] = await Promise.all([storage.getItem('token'), storage.getItem('user')]);

      if (!token) {
        set({ token: null, user: null, isAuthenticated: false, hydrated: true });
        return;
      }

      // Parsed separately and deliberately non-fatally: the token is what authenticates the
      // session, the cached user object is only a render convenience that the profile query
      // refetches anyway. A corrupt blob here used to fall into the catch below and sign a
      // perfectly valid session out.
      let parsedUser: AuthUser = null;
      if (user) {
        try {
          parsedUser = JSON.parse(user) as AuthUser;
        } catch {
          await storage.removeItem('user');
        }
      }

      set({
        token,
        user: parsedUser,
        isAuthenticated: true,
        hydrated: true,
      });
    } catch (error) {
      console.warn('Unable to hydrate auth state', error);
      set({ token: null, user: null, isAuthenticated: false, hydrated: true });
    }
  },

  login: async (token, user) => {
    if (userId(get().user) && userId(get().user) !== userId(user)) {
      await clearAuthenticatedSession();
    }
    await Promise.all([
      storage.setItem('token', token),
      // `?? null` keeps this a valid string write: AsyncStorage rejects a non-string value,
      // and `JSON.stringify(undefined)` returns undefined rather than a string.
      storage.setItem('user', JSON.stringify(user ?? null)),
    ]);

    set({ token, user, isAuthenticated: true, hydrated: true });
  },

  logout: async () => {
    // Best-effort, and deliberately first: this is what deletes the server session and
    // invalidates the 7-day refresh cookie held by the native cookie store. Clearing only
    // local storage would leave a resumable session behind. A network failure must still
    // let the user sign out locally, so the result is ignored.
    //
    // Lazy require, matching src/api/client.ts: a static import here would close the
    // authStore → auth.service → api/client → authStore cycle at module load time.
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { logoutUser } = require('../services/auth.service') as typeof import('../services/auth.service');
      await logoutUser();
    } catch {
      // Offline, or the session was already gone server-side. Sign out locally regardless.
    }
    await clearAuthenticatedSession();
    await storage.removeItem('token');
    await storage.removeItem('user');
    set({ token: null, user: null, isAuthenticated: false, hydrated: true });
  },

  updateUser: async (patch) => {
    const currentUser = get().user ?? {};
    const nextUser = { ...currentUser, ...patch };

    await storage.setItem('user', JSON.stringify(nextUser));
    set({ user: nextUser, hydrated: true });
  },
}));

export type { AuthUser };
