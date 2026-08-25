export const queryKeys = {
  chats: {
    all: ['chats'] as const,
    detail: (chatId: string) => ['chats', 'detail', chatId] as const,
  },
  auth: {
    profile: ['auth', 'profile'] as const,

    /**
     * Query key for the current user's active login sessions
     * (GET /api/auth/sessions). Used by the Active Sessions settings screen.
     *
     * This key is intentionally nested under `auth` so it is torn down by the
     * blanket `queryClient.removeQueries()` in authStore's
     * `clearAuthenticatedSession()` on logout / account switch. Session data is
     * private to one account and must never survive into another user's session,
     * so it lives ONLY in the TanStack cache — never in AsyncStorage or Zustand.
     */
    sessions: ['auth', 'sessions'] as const,
  },
  subscription: {
    current: ['subscription', 'current'] as const,
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

    /**
     * Query key for the listings the authenticated user has posted.
     * Used by useMyJobs (GET /api/services/my-posted) on the Mine annonser screen.
     */
    mine: ['jobs', 'mine'] as const,
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
    history: ['safepay', 'history'] as const,
  },
  providerOrders: {
    all: ['provider-orders'] as const,
    detail: (orderId: string) => ['provider-orders', 'detail', orderId] as const,
    reviews: (orderId: string) => ['provider-orders', 'reviews', orderId] as const,
  },
  disputes: {
    byOrder: (orderId: string) => ['disputes', 'order', orderId] as const,
  },
  payout: {
    status: ['payout', 'status'] as const,
  },
  plans: {
    /**
     * Query key for the public subscription plan catalogue (GET /api/plans).
     * Used by usePlans on the Membership screen. The endpoint returns every plan
     * including inactive ones, so the hook filters `isActive` client-side.
     */
    all: ['plans', 'all'] as const,
  },
  support: {
    mine: ['support', 'mine'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (type?: string) => ['notifications', 'list', type ?? 'all'] as const,
    unreadCount: ['notifications', 'unreadCount'] as const,
  },
  favoriteLists: {
    /**
     * The signed-in user's saved lists (GET /api/lists, no userId param — the server
     * derives the owner from the token). One shared entry, so the Favorites overview,
     * the "Lagre i liste" sheet and every JobCard bookmark read the same cache and
     * cause a single request.
     *
     * Favorites are private per-account server state. They live ONLY here — never in
     * AsyncStorage and never in Zustand — so `queryClient.removeQueries()` in
     * authStore's `clearAuthenticatedSession()` tears them down on logout and on an
     * account switch. There is deliberately no second local source of truth.
     */
    all: ['favoriteLists', 'all'] as const,

    /**
     * One saved list with its populated services (GET /api/lists/:listId).
     * Nested under the same root so a broad invalidate reaches overview and details.
     */
    detail: (listId: string) => ['favoriteLists', 'detail', listId] as const,
  },
} as const;
