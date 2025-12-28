import axios from "axios";
import { useUserStore } from "../stores/userStore";

export const mainLink = "http://localhost:5001";

export const api = axios.create({
  baseURL: `${mainLink}/api`,
});

// ✅ NO HOOK — SAFE WAY
api.interceptors.request.use((config) => {
  const { tokens } = useUserStore.getState();
  const token = tokens?.accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});
