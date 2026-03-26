import mainLink from "../../api/mainURLs";

export async function userLogin(credentials: { email: string; password: string }) {
  const res = await mainLink.post("/api/auth/login", credentials);
  return res.data;
}

export async function registerUser(userData: {
  name: string;
  email: string;
  password: string;
  lastName: string;
}) {
  const res = await mainLink.post("/api/auth/register", userData);
  return res.data;
}

export async function logoutUser() {
  const res = await mainLink.post("/api/auth/logout");
  return res.data;
}

export async function refreshToken() {
  const res = await mainLink.post("/api/auth/refresh-token");
  return res.data;
}

export async function getUserSessions() {
  const res = await mainLink.get("/api/auth/sessions");
  return res.data;
}

export async function revokeSession(sessionId: string) {
  const res = await mainLink.delete(`/api/auth/sessions/${sessionId}`);
  return res.data;
}

export async function revokeAllOtherSessions() {
  const res = await mainLink.delete("/api/auth/sessions/revoke-others");
  return res.data;
}

export async function fetchProfile() {
  const res = await mainLink.get("/api/auth/profile");
  return res.data;
}
