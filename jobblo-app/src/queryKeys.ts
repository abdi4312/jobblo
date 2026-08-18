export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  jobs: {
    /**
     * Query key for job listing with optional filters.
     * Used by useJobs hook for consistent cache invalidation.
     */
    list: (params?: {
      page?: number;
      limit?: number;
      categories?: string[];
      search?: string;
      sort?: string;
      urgent?: boolean;
    }) => ['jobs', 'list', params] as const,

    /**
     * Query key for infinite pagination of jobs.
     * Used by useInfiniteJobs hook for Explore/Search screen.
     * Each filter change produces a new query key, naturally resetting the query.
     */
    infinite: (params?: {
      limit?: number;
      categories?: string[];
      search?: string;
      sort?: string;
      urgent?: boolean;
    }) => ['jobs', 'infinite', params] as const,

    /**
     * Query key for individual job details.
     */
    detail: (jobId: string) => ['jobs', 'detail', jobId] as const,
  },
  categories: {
    /**
     * Query key for all categories with icons and filter options.
     * Used by useCategories hook for Home and Explore screens.
     */
    all: ['categories', 'all'] as const,
  },
} as const;
