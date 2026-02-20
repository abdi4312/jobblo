import mainLink from "../../api/mainURLs";
import { getFavorites } from "../../api/favoriteAPI";

export const getJobDetail = async (id: string) => {
  const response = await mainLink.get(`/api/services/${id}`);
  return response.data;
};

export const checkIsFavorited = async (id: string) => {
  const res = await getFavorites();
  return res.data.some((fav: any) => fav.service._id === id);
};

export const getNearbyJobs = async (lat: number, lng: number, radius: number = 50000) => {
  const { data } = await mainLink.get(`/api/services/nearby`, {
    params: { lat, lng, radius },
  });
  return data;
};

export const createChat = async (payload: { providerId: string; serviceId: string }) => {
  const { data } = await mainLink.post("/api/chats/create", payload);
  return data;
};

// 4. Stripe Payment API (402 error handling ke liye)
export const createStripeSession = async (payload: { amount: number; providerId: string; serviceId: string }) => {
  const { data } = await mainLink.post("/api/stripe/create-extra-contact-payment", payload);
  return data;
};