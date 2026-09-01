import { Stack } from 'expo-router';

/** Lagrede lister: overview → list detail. Headers are drawn inside each screen. */
export default function FavoritesLayout() {
    return <Stack screenOptions={{ headerShown: false }} />;
}
