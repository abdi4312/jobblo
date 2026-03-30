import mainLink from "../../api/mainURLs";
import type { UserUpdatePayload } from "./types/user";

export const updateUser = async (userId: string, data: UserUpdatePayload) => {
  const response = await mainLink.put(`/api/users/${userId}`, data);
  return response.data;
};

export const getUserProfile = async (userId: string) => {
  const response = await mainLink.get(`/api/users/${userId}`);
  return response.data;
};

export const followUser = async (userId: string) => {
  const response = await mainLink.post(`/api/users/${userId}/follow`);
  return response.data;
};

export const blockUser = async (userId: string) => {
  const response = await mainLink.post(`/api/users/${userId}/block`);
  return response.data;
};

export const getBlockedUsers = async (page = 1, limit = 10) => {
  const response = await mainLink.get("/api/users/blocked", {
    params: { page, limit }
  });
  return response.data;
};

export const searchUsers = async (query?: string) => {
  const response = await mainLink.get("/api/users/search", {
    params: { query }
  });
  return response.data;
};

export const getTopUsers = async () => {
  const response = await mainLink.get("/api/users/top");
  return response.data;
};

export const searchAll = async (query: string, type?: string, page?: number, limit?: number) => {
  const response = await mainLink.get("/api/users/search-all", {
    params: { query, type, page, limit }
  });
  return response.data;
};