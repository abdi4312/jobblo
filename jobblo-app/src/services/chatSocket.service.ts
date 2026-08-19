import { io, type Socket } from 'socket.io-client';
import { apiBaseUrl } from '../api/client';
import { useAuthStore } from '../store/authStore';

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
      auth: { token: useAuthStore.getState().token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    socket.on('reconnect_attempt', () => {
      if (socket) socket.auth = { token: useAuthStore.getState().token };
    });
    if (__DEV__) {
      socket.on('connect_error', (error) => console.warn('[chat] socket connection failed:', error.message));
      socket.on('disconnect', (reason) => console.warn('[chat] socket disconnected:', reason));
    }
  }
  return socket;
}
