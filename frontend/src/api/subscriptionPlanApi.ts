import mainLink from "./mainURLs";

export async function getSubscriptionPlans() {
  const res = await mainLink.get("/api/plans");
  return res.data;
}
