//! Import used for Fetch API
// import { mainLink } from "./mainURLs.ts;

import type { AuthTokens } from "../types/userTypes.ts";
import axios from "axios";
import type { FavoritesResponse } from "../types/FavoritesTypes.ts";

// export async function getFavorites(userToken: AuthTokens | null) {
//   const myHeaders = new Headers();
//   myHeaders.append("accept", "application/json");
//   myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);
//
//   const res = await fetch(`${mainLink}/api/favorites`, {
//     method: "GET",
//     headers: myHeaders,
//   });
//   return await res.json();
// }

export async function getFavorites(userToken: AuthTokens | null) {
  const res = await axios.get<FavoritesResponse>("/api/favorites", {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${userToken?.accessToken}`,
    },
  });

  return res.data;
}

// export async function setFavorites(
//   serviceId: string,
//   userToken: AuthTokens | null,
// ) {
//   const myHeaders = new Headers();
//   myHeaders.append("accept", "application/json");
//   myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);
//
//   const res = await fetch(`${mainLink}/api/favorites/${serviceId}`, {
//     method: "POST",
//     headers: myHeaders,
//   });
//   return await res.json();
// }

export async function setFavorites(
  serviceId: string,
  userToken: AuthTokens | null,
) {
  const res = await axios.post(
    `/api/favorites/${serviceId}`,
    {},
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${userToken?.accessToken}`,
      },
    },
  );
  return res.data;
}

// export async function deleteFavorites(
//   serviceId: string,
//   userToken: AuthTokens | null,
// ) {
//   const myHeaders = new Headers();
//   myHeaders.append("accept", "application/json");
//   myHeaders.append("Authorization", `Bearer ${userToken?.accessToken}`);
//
//   const res = await fetch(`${mainLink}/api/favorites/${serviceId}`, {
//     method: "DELETE",
//     headers: myHeaders,
//   });
//   return await res.json();
// }

export async function deleteFavorites(
  serviceId: string,
  userToken: AuthTokens | null,
) {
  const res = await axios.delete(`/api/favorites/${serviceId}`, {
    headers: {
      accept: "application/json",
      Authorization: `Bearer ${userToken?.accessToken}`,
    },
  });
  return res.data;
}
