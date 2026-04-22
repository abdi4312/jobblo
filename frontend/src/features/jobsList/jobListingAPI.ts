import mainLink from "../../api/mainURLs";
import type { Jobs } from "./types";
import type { Tab } from "../../types/tabs";

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
  tab?: Tab;
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
  tab = "Discover",
}: FetchJobsParams): Promise<JobsResponse> => {
  // Use the main services endpoint
  const url = "/api/services";

  const res = await mainLink.get(url, {
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

  if (res.data.success && Array.isArray(res.data.data)) {
    return {
      data: res.data.data,
      pagination: res.data.pagination || {
        total: res.data.count || res.data.data.length,
        totalPages: 1,
        page: 1,
        limit: res.data.data.length,
      },
    };
  }

  return res.data;
};
