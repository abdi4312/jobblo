import axios from "axios";

// export async function getCategories() {
//   const res = await fetch(`${mainLink}/api/categories`);
//   return await res.json();
// }

//TODO ask about function vs variable/const
export async function getCategories() {
  const res = await axios.get("/api/categories");
  return res.data;
}
