import { Redirect, Tabs } from 'expo-router';
import { Home, Search } from 'lucide-react-native';
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
                name="explore"
                options={{ title: 'Utforsk', tabBarIcon: ({ color, size }) => <Search size={size} color={color} /> }}
            />
        </Tabs>
    );
}
