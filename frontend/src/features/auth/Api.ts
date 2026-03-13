import { useUserStore } from "../../stores/userStore";
import  mainLink  from "../../api/mainURLs"; // ensure mainLink is Axios instance

export async function userLogin(email: string, password: string) {
  try {
    // POST login request
    const res = await mainLink.post("/api/auth/login", { email, password });

    const { fetchProfile } = useUserStore.getState();
    await fetchProfile();

    return res.data;
  } catch (error: any) {
    console.error("Login failed:", error.response?.data || error.message);
    throw error;
  }
}

export async function registerUser(userData: {
  name: string;
  email: string;
  password: string;
  phone?: string;
}) {
  try {
    const res = await mainLink.post("/api/auth/register", userData);
    const { fetchProfile } = useUserStore.getState();
    await fetchProfile();
    return res.data;
  } catch (err: any) {
    console.error("Registration failed:", err.response?.data || err.message);
    throw err;
  }
}