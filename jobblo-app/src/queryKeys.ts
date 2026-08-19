export const queryKeys = {
  chats: {
    all: ['chats'] as const,
    detail: (chatId: string) => ['chats', 'detail', chatId] as const,
  },
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
  applications: {
    /**
     * Query key for all applications/job requests (those I've sent).
     * Used by useApplyMutation for cache invalidation after applying.
     */
    all: ['applications', 'all'] as const,

    /**
     * Query key for the current user's application list with optional filters.
     */
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      ['applications', 'list', params ?? {}] as const,

    /**
     * Query key for a single job request by ID.
     */
    detail: (requestId: string) => ['applications', 'detail', requestId] as const,
  },
  applicants: {
    all: ['applicants', 'all'] as const,
    overview: ['applicants', 'overview'] as const,
    detailRoot: ['applicants', 'detail'] as const,
    detail: (params: { serviceId: string; sort: string; filter: string }) =>
      ['applicants', 'detail', params] as const,
  },
  safepay: {
    checkout: (orderId: string) => ['safepay', 'checkout', orderId] as const,
    status: (sessionId: string) => ['safepay', 'status', sessionId] as const,
  },
  providerOrders: {
    all: ['provider-orders'] as const,
    detail: (orderId: string) => ['provider-orders', 'detail', orderId] as const,
    reviews: (orderId: string) => ['provider-orders', 'reviews', orderId] as const,
  },
  disputes: {
    byOrder: (orderId: string) => ['disputes', 'order', orderId] as const,
  },
} as const;
