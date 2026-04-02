import axios from "axios";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

// Android Emulator: 10.0.2.2
// Real Device: Your Computer's Local IP (e.g., 192.168.1.5)
const DEV_IP = "192.168.79.26";

const BASE_URL =
  Platform.OS === "android"
    ? `http://${DEV_IP}:5001/api`
    : "http://localhost:5001/api";

console.log("API Base URL:", BASE_URL);

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync("token");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error("Error fetching token from SecureStore:", error);
    }

    console.log("--- Request ---");
    console.log("Method:", config.method?.toUpperCase());
    console.log("URL:", config.baseURL + (config.url || ""));
    if (config.headers.Authorization) {
      console.log("Auth:", "Bearer [HIDDEN]");
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => {
    console.log("--- Response Success ---");
    console.log("Status:", response.status);
    return response;
  },
  (error) => {
    console.log("--- Response Error ---");
    console.log("Message:", error.message);
    console.log("Code:", error.code);
    if (error.response) {
      console.log("Data:", JSON.stringify(error.response.data));
      console.log("Status:", error.response.status);
    }
    return Promise.reject(error);
  },
);
