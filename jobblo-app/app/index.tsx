import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/authStore';

/**
 * Entry gate for `/`.
 *
 * `app/(app)/index.tsx` also resolves to `/`, so this screen never renders UI — it only
 * decides which group the session belongs in, and always redirects to an explicit group
 * path (`/(app)` or `/(auth)/welcome`) so the collision cannot pick the wrong screen.
 *
 * Rendering nothing until `hydrated` is what stops the cold-start bounce to the welcome
 * screen for a user who already has a stored token.
 */
export default function Index() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!hydrated) return null;

  return <Redirect href={isAuthenticated ? '/(app)' : '/(auth)/welcome'} />;
}
