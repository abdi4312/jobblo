import { Redirect, Tabs } from 'expo-router';
import { Home, MessageCircle, PlusCircle, UserRound } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';

export default function AppLayout() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

    if (!isAuthenticated) {
        return <Redirect href="/(auth)/login" />;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#FFFFFF',
                    borderTopColor: '#E6E7E1',
                    borderTopWidth: 1,
                },
                tabBarActiveTintColor: '#2E6641',
                tabBarInactiveTintColor: '#9B9E96',
                tabBarLabelStyle: { fontSize: 11, fontWeight: '500' as const },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{ title: 'Hjem', tabBarIcon: ({ color, size }) => <Home size={size} color={color} /> }}
            />
            <Tabs.Screen
                name="create-job"
                options={{ title: 'Legg ut', tabBarIcon: ({ color, size }) => <PlusCircle size={size} color={color} /> }}
            />
            <Tabs.Screen
                name="messages"
                options={{ title: 'Meldinger', tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} /> }}
            />
            <Tabs.Screen
                name="profile"
                options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} /> }}
            />
            <Tabs.Screen
                name="explore"
                options={{ href: null }}
            />
            <Tabs.Screen
                name="my-applications"
                options={{ href: null }}
            />
        </Tabs>
    );
}
