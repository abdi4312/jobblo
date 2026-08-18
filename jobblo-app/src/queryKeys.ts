export const queryKeys = {
  auth: {
    profile: ['auth', 'profile'] as const,
  },
  jobs: {
    /**
     * Query key for job listing with optional filters.
     * Used by useJobs hook for consistent cache invalidation.
     * Includes ALL applicable filters so any filter change invalidates the cache.
     */
    list: (params?: {
      page?: number;
      limit?: number;
      categories?: string[];
      search?: string;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      urgent?: boolean;
      countyCodes?: string[];
      municipalityCodes?: string[];
      areaCodes?: string[];
      lat?: number;
      lng?: number;
      radius?: number;
    }) => ['jobs', 'list', params] as const,

    /**
     * Query key for infinite pagination of jobs.
     * Used by useInfiniteJobs hook for Explore/Search screen.
     * Each filter change produces a new query key, naturally resetting pagination.
     * Includes EVERY applied server filter to ensure proper cache behavior.
     */
    infinite: (params?: {
      limit?: number;
      categories?: string[];
      search?: string;
      sort?: string;
      minPrice?: number;
      maxPrice?: number;
      urgent?: boolean;
      countyCodes?: string[];
      municipalityCodes?: string[];
      areaCodes?: string[];
      lat?: number;
      lng?: number;
      radius?: number;
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
  locations: {
    /**
     * Query key for location tree (counties → municipalities → areas).
     * Used by useLocationTree hook for location filter UI.
     */
    tree: ['locations', 'tree'] as const,

    /**
     * Query key for location statistics (job counts per region).
     * Used by useLocationStats hook.
     */
    stats: ['locations', 'stats'] as const,
  },
} as const;
