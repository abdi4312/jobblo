import axios from "axios";

export async function userLogin(email: string, password: string) {
  const res = await axios.post(
    "/api/auth/login",
    { email, password },
    {
      headers: { "Content-Type": "application/json" },
    },
  );

  return res;
}
