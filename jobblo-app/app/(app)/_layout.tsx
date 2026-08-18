import { Redirect, Tabs } from 'expo-router';
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';

export default function AppLayout() {
    const { isAuthenticated, hydrate } = useAuthStore();
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        hydrate().finally(() => setHydrated(true));
    }, []);

    if (!hydrated) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF0EA' }}>
                <ActivityIndicator color="#2E6641" size="large" />
            </View>
        );
    }

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
                options={{
                    title: 'Hjem',
                    tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="explore"
                options={{
                    title: 'Utforsk',
                    tabBarIcon: ({ color, size }) => <Search size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="post"
                options={{
                    title: 'Legg ut',
                    tabBarIcon: ({ color, size }) => <PlusCircle size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="messages"
                options={{
                    title: 'Meldinger',
                    tabBarIcon: ({ color, size }) => <MessageCircle size={size} color={color} />,
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profil',
                    tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
                }}
            />
        </Tabs>
    );
}
