import { io, Socket } from "socket.io-client";
import mainLink from "../api/mainURLs";

let socket: Socket | null = null;

export const initSocket = (forceRefresh = false) => {
  const baseURL = import.meta.env.VITE_MAIN_URL;
  
  if (forceRefresh && socket) {
    console.log("🔄 Force refreshing socket connection...");
    socket.disconnect();
    socket = null;
  }

  if (!socket) {
    console.log("🔌 Initializing new socket connection to:", baseURL);
    socket = io(baseURL, {
      transports: ["websocket"],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket?.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.log("❌ Socket disconnected:", reason);
    });
  }

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    console.log("🔌 Manually disconnecting socket...");
    socket.disconnect();
    socket = null;
  }
};
