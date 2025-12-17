import { mainLink } from "./mainURLs.ts";

export async function getFavorites() {
  const res = await fetch(`${mainLink}/api/favorites`);
  return await res.json();
}

export async function setFavorites() {
  const res = await fetch(`${mainLink}/api/favorites`);
  return await res.json();
}
