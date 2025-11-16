import { mainLink } from "./mainURLs.ts";

export async function getCategories() {
  const res = await fetch(`${mainLink}/api/categories`);
  return await res.json();
}
