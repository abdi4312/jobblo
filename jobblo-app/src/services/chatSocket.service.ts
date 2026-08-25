import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from '../api/client';

// Lazy import to break the circular dependency:
// authStore → chatSocket.service → authStore
// getState() is only called at runtime (not at module load), so by the time
// it runs both modules are fully initialized.
function getToken(): string | null {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require('../store/authStore').useAuthStore.getState().token ?? null;
}

const socketUrl = apiBaseUrl.replace(/\/api\/?$/, '');
let socket: Socket | null = null;

export function destroyChatSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}

export function getChatSocket() {
  if (!socket) {
    socket = io(socketUrl, {
      auth: { token: getToken() },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socket.on('reconnect_attempt', () => {
      if (socket) socket.auth = { token: getToken() };
    });
    if (__DEV__) {
      socket.on('connect_error', (error) => console.warn('[chat] socket connection failed:', error.message));
      socket.on('disconnect', (reason) => console.warn('[chat] socket disconnected:', reason));
    }
  }
  return socket;
}
