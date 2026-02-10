import mainLink from "./mainURLs";

export async function getJobbloShop() {
  const res = await mainLink.get("/api/jobbloShop");
  return res.data;
}

export async function buyItem(id: string) {
  const res = await mainLink.post("/api/jobbloShop/buy", { id });
  return res.data;
}