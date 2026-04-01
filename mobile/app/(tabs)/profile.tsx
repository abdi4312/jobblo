import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'expo-router';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  return (
    <View className="flex-1 items-center justify-center bg-white p-6">
      <View className="items-center mb-8">
        <View className="w-24 h-24 bg-gray-200 rounded-full items-center justify-center mb-4">
          <Text className="text-3xl font-bold text-gray-500">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>
        <Text className="text-2xl font-bold text-gray-800">{user?.name || 'User'}</Text>
        <Text className="text-gray-500">{user?.email || 'email@example.com'}</Text>
      </View>

      <TouchableOpacity
        onPress={handleLogout}
        className="w-full bg-red-500 py-4 rounded-xl items-center"
      >
        <Text className="text-white font-bold text-lg">Logg ut</Text>
      </TouchableOpacity>
    </View>
  );
}
