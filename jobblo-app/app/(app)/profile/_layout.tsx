import { Stack } from 'expo-router';

/**
 * Stack navigator for the profile section.
 * All profile/* and profile/settings/* screens push onto this stack.
 * The tab bar remains visible (managed by the parent Tabs layout).
 * headerShown: false — each screen renders its own header.
 */
export default function ProfileLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
}
