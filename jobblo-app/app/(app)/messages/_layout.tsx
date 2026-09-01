import { Stack } from 'expo-router';

/**
 * Stack navigator for the messages section.
 * messages/index and messages/[chatId] push onto this stack.
 * headerShown: false — each screen renders its own header.
 */
export default function MessagesLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }} />
    );
}
