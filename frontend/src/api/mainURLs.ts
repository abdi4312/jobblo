import axios from "axios";
import { setupInterceptors } from "../lib/axios";

// Define your API base URL here
const BASE_URL = import.meta.env.VITE_MAIN_URL || "http://localhost:5000";

/**
 * Main Axios instance for the application.
 * Setup with production-level interceptors (Auth, Refresh Token, etc.)
 */
const mainLink = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// interceptors from lib/axios
setupInterceptors(mainLink);

export default mainLink;
