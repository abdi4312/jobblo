import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from '../config/env';

let socket: Socket | null = null;

export const initSocket = (forceRefresh = false) => {
  const baseURL = API_BASE_URL;

  if (forceRefresh && socket) {
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    socket = io(baseURL, {
      // 'websocket' only meant corporate proxies and networks that block the
      // upgrade got no real-time features at all. Polling is the fallback the
      // transport list exists for.
      transports: ['websocket', 'polling'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    socket.on('connect_error', (err) => {
      console.error('Socket connection error:', err.message);
    });
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
