import { QueryClient } from '@tanstack/react-query';

/**
 * The app's single TanStack Query client.
 *
 * It lives here rather than in `AppProviders.tsx` to break a require cycle: the auth store
 * needs `queryClient` to drop cached data on logout, `AppProviders` needs the auth store to
 * hydrate the session, and Metro warned about the resulting
 * `authStore → AppProviders → authStore` loop. A cycle like that resolves to `undefined` for
 * whichever module happens to be evaluated second, which would have turned logout's cache
 * teardown into a silent no-op. This module imports nothing of ours, so it cannot cycle.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
