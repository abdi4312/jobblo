import mainLink from "../../api/mainURLs";
import type { Jobs } from "./types";

interface FetchJobsParams {
  page?: number;
  limit?: number;
  categories?: string[];
  search?: string;
}

export interface JobsResponse {
  data: Jobs[];
  pagination: {
    total: number;
    totalPages: number;
  };
}

export const fetchJobs = async ({
  page = 1,
  limit = 16,
  categories = [],
  search = "",
}: FetchJobsParams): Promise<JobsResponse> => {
  const res = await mainLink.get("/api/services", {
    params: {
      page,
      limit,
      category: categories.length ? categories.join(",") : undefined,
      search: search || undefined,
    },
  });

  return res.data;
};
