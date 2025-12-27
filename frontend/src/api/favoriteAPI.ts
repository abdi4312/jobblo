import { mainLink } from "./mainURLs.ts";
import type { AuthTokens } from "../types/userTypes.ts";

export async function getFavorites(userToken: AuthTokens | null) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);

  const res = await fetch(`${mainLink}/api/favorites`, {
    method: "GET",
    headers: myHeaders,
  });
  return await res.json();
}

export async function setFavorites(
  serviceId: string,
  userToken: AuthTokens | null,
) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);

  const res = await fetch(`${mainLink}/api/favorites/${serviceId}`, {
    method: "POST",
    headers: myHeaders,
  });
  return await res.json();
}

export async function deleteFavorites(
  serviceId: string,
  userToken: AuthTokens | null,
) {
  const myHeaders = new Headers();
  myHeaders.append("accept", "application/json");
  myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);

  const res = await fetch(`${mainLink}/api/favorites/${serviceId}`, {
    method: "DELETE",
    headers: myHeaders,
  });
  return await res.json();
}
