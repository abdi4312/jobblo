import type { Jobs } from "../../types/Jobs";

export interface FavoriteList {
  _id: string;
  name: string;
  user: string;
  services: Jobs[] | string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateListDTO {
  name: string;
}

export interface UpdateListDTO {
  name?: string;
  isPublic?: boolean;
}

export interface AddServiceToListDTO {
  listId: string;
  serviceId: string;
}
