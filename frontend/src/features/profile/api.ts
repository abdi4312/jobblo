import mainLink from "../../api/mainURLs";
import type { UserUpdatePayload } from "./types/user";

export const updateUser = async (userId: string, data: UserUpdatePayload) => {
  const response = await mainLink.put(`/api/users/${userId}`, data);
  return response.data;
};