import mainLink from "./mainURLs";

//TODO ask about function vs variable/const
export async function getCategories() {
  const res = await mainLink.get("/api/categories");
  return res.data;
}
