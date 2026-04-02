import { api } from "../../auth/api/client";
import { ListUser } from "../../list/types";

export const searchUsers = async (query: string): Promise<ListUser[]> => {
  const response = await api.get("/users/search", {
    params: {
      query: query,
    },
  });
  return response.data;
};
