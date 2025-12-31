import mainLink from "./mainURLs";

export async function userLogin(email: string, password: string) {
  const res = await mainLink.post(
    "/api/auth/login",
    { email, password },
  );

  return res;
}
