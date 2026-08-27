import { Redirect, Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { Home, MessageCircle, PlusCircle, UserRound, Bell } from 'lucide-react-native';
import { useAuthStore } from '@/store/authStore';
import { useUnreadCount } from '@/hooks/useNotifications';

function BellIcon({ color, size }: { color: string; size: number }) {
  const { data } = useUnreadCount();
  const count = data?.count ?? 0;
  return (
    <View>
      <Bell size={size} color={color} />
      {count > 0 && (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: '#B4544A',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AppLayout() {
  const hydrated = useAuthStore((s) => s.hydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Until the persisted session is read back, "not authenticated" is unknown rather than
  // false. Redirecting here would kick a signed-in user to the login screen on every cold
  // start, and a deep link into this group would lose its target.
  if (!hydrated) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <Tabs
      // Most screens in this group are hidden tab routes (`href: null`), so cross-section
      // navigation like SafePay -> "Mine søkere" is a tab switch, not a stack push. With the
      // default `firstRoute`, `changeIndex` rewrites the tab history to [index, target], so
      // every back action out of those hidden screens lands on Hjem instead of the screen the
      // user actually came from. `history` returns to the last visited tab instead.
      backBehavior="history"
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
      {/* 5 visible tabs */}
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hjem',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-job"
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
        name="alerts"
        options={{
          title: 'Varsler',
          tabBarIcon: ({ color, size }) => <BellIcon color={String(color)} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, size }) => <UserRound size={size} color={color} />,
        }}
      />
      {/* Hidden flat screens */}
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="my-applications" options={{ href: null }} />
      <Tabs.Screen name="my-jobs" options={{ href: null }} />
      {/* Folder-based sections each have their own _layout.tsx (Stack).
                Registering the folder name here hides it from the tab bar. */}
      <Tabs.Screen name="jobs" options={{ href: null }} />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="job-applicants" options={{ href: null }} />
      <Tabs.Screen name="provider" options={{ href: null }} />
      <Tabs.Screen name="safepay" options={{ href: null }} />
      <Tabs.Screen name="disputes" options={{ href: null }} />
    </Tabs>
  );
}
