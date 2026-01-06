import { io, Socket } from "socket.io-client";
import mainLink from "../api/mainURLs";

let socket: Socket | null = null;

export const initSocket = () => {
  if (!socket) {
    socket = io(mainLink.defaults.baseURL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });
  }

  return socket;
};

export const disconnectSocket = () => {
  if (socket && socket.connected) {
    socket.disconnect();
  }
  socket = null;
};
