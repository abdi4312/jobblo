import { io, Socket } from "socket.io-client";
import { mainLink } from "../api/mainURLs";

let socket: Socket | null = null;

export const initSocket = (token?: string) => {
  if (!socket) {
    socket = io(mainLink, {
      auth: token ? { token } : undefined,
      transports: ["websocket"],
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
