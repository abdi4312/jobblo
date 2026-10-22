import { AppState, type NativeEventSubscription } from 'react-native';
import { io, type Socket } from 'socket.io-client';
import apiClient, { apiBaseUrl } from '../api/client';

// Lazy import to break the circular dependency:
// authStore → chatSocket.service → authStore
// getState() is only called at runtime (not at module load), so by the time
// it runs both modules are fully initialized.
function getToken(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../store/authStore').useAuthStore.getState().token ?? null;
}

const socketUrl = apiBaseUrl.replace(/\/api\/?$/, '');
const AUTH_RETRY_MS = 5000;
let socket: Socket | null = null;
let authRetryTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;

/**
 * The OS freezes JS in the background, so the server's pings go unanswered and it drops the
 * socket ("ping timeout"); socket.io then reconnects on its backoff, up to 15 s after the
 * user is back. Close it cleanly on background and reconnect at once on foreground instead.
 */
function handleAppState(state: string) {
  if (!socket) return;
  if (state === 'background') socket.disconnect();
  else if (state === 'active' && !socket.connected && getToken()) socket.connect();
}

export function destroyChatSocket() {
  if (authRetryTimer) clearTimeout(authRetryTimer);
  authRetryTimer = null;
  appStateSub?.remove();
  appStateSub = null;
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

/**
 * The server's auth middleware refused the handshake — almost always because the 1-hour
 * access token expired. socket.io treats that refusal as final (`socket.active` is false)
 * and never retries by itself, so chat and live notifications stayed dead until the app
 * restarted. Any authenticated API call refreshes the token through api/client.ts's 401
 * handler; after that the socket reconnects with the new one. If the session is truly gone,
 * that handler logs out, which destroys this socket and ends the retries.
 */
function handleConnectError(error: Error) {
  if (__DEV__) console.warn('[chat] socket connection failed:', error.message);
  if (!socket || socket.active || authRetryTimer) return;
  authRetryTimer = setTimeout(async () => {
    authRetryTimer = null;
    try {
      await apiClient.get('/auth/profile');
    } catch {
      // Offline or signed out; the next connect_error schedules another attempt.
    }
    if (socket && !socket.connected && getToken()) socket.connect();
  }, AUTH_RETRY_MS);
}

export function getChatSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      // A function, so every connect AND reconnect sends the current token. The old object
      // was captured once, and the `reconnect_attempt` hook meant to refresh it was attached
      // to the socket, where socket.io v4 never emits it (it fires on `socket.io`).
      auth: (cb) => cb({ token: getToken() }),
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      // Keep trying through long offline periods (subway, flight mode); the old cap of 10
      // attempts gave up for good after about a minute.
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 15000,
    });
    socket.on('connect_error', handleConnectError);
    appStateSub = AppState.addEventListener('change', handleAppState);
    if (__DEV__) {
      // 'io client disconnect' is our own background disconnect (handleAppState), not a fault.
      socket.on('disconnect', (reason) => {
        if (reason !== 'io client disconnect') console.warn('[chat] socket disconnected:', reason);
      });
    }
  }
  return socket;
}
