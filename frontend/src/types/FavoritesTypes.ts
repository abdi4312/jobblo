import type { User } from "./userTypes.ts";
import type { Jobs } from "./Jobs.ts";

export type FavoritesResponse = {
  success: boolean;
  count: number;
  data: Favorites[];
};

type Favorites = {
  _id: string;
  user: User;
  service: Jobs;
};
