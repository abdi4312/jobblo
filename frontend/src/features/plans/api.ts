import mainLink from "../../api/mainURLs";

export const getPlans = async () => {
  const res = await mainLink.get("/api/plans");
  return res.data;
};
