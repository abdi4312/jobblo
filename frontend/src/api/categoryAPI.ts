import mainLink from "./mainURLs";

export async function getCategories() {
  const res = await mainLink.get("/api/categories");
  return res.data;
}
