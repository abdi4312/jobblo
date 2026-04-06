import mainLink from "../../api/mainURLs";
import type { Jobs } from "./types";

interface FetchJobsParams {
  page?: number;
  limit?: number;
  categories?: string[];
  locations?: string[];
  search?: string;
  sort?: string;
  userId?: string;
  urgent?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface JobsResponse {
  data: Jobs[];
  pagination: {
    total: number;
    totalPages: number;
    page: number;
    limit: number;
  };
}

export const fetchJobs = async ({
  page = 1,
  limit = 16,
  categories = [],
  locations = [],
  search = "",
  sort = "",
  userId = "",
  urgent = false,
  minPrice,
  maxPrice,
}: FetchJobsParams): Promise<JobsResponse> => {
  const res = await mainLink.get("/api/services", {
    params: {
      page,
      limit,
      category: categories.length ? categories.join(",") : undefined,
      location: locations.length ? locations.join(",") : undefined,
      search: search || undefined,
      sort: sort || undefined,
      userId: userId || undefined,
      urgent: urgent || undefined,
      minPrice: minPrice !== undefined ? minPrice : undefined,
      maxPrice: maxPrice !== undefined ? maxPrice : undefined,
    },
  });

  return res.data;
};
