import { Redirect, Stack, usePathname } from 'expo-router';
import { useAuthStore } from '@/store/authStore';

export default function AuthLayout() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const pathname = usePathname();

  // Wait for the persisted session before deciding: rendering the login form first and
  // redirecting afterwards would flash sign-in UI at an already signed-in user.
  if (!hydrated) return null;

  /**
   * The redirect renders BESIDE this group's navigator, never instead of it.
   *
   * `Redirect` navigates from a `useFocusEffect` whose callback is a new function on every
   * render and is also one of its dependencies, so it dispatches `router.replace` once per
   * render rather than once per mount. Returning it in place of the `<Stack>` unmounted this
   * group's navigator on the first dispatch, and the second one then had no navigator for the
   * route it was leaving: "Couldn't find a navigation context", swallowed by Redirect's own
   * try/catch and printed twice — once per repeat.
   *
   * Keeping the navigator mounted costs a frame of an auth screen that is on its way out (they
   * are plain forms and fetch nothing), and the group unmounts a moment later as a consequence
   * of the router leaving it, which is the path expo-router expects.
   */
  return (
    <>
      {isAuthenticated && pathname !== '/terms-acceptance' ? <Redirect href="/(app)" /> : null}
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade',
          contentStyle: { backgroundColor: '#F8FAFC' },
        }}
      />
    </>
  );
}
