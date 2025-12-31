import axios from "axios";
import { useUserStore } from "../stores/userStore";

const mainLink = axios.create({
  baseURL: "http://localhost:5000",
  headers: {
    Accept: "application/json",
  },
});

// 🔐 Bearer Token auto attach
mainLink.interceptors.request.use(
  (config) => {
    const { tokens } = useUserStore.getState();
    const token = tokens?.accessToken;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default mainLink;
