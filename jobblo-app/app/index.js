import { View, Text, ScrollView } from "react-native";
import { Link } from "expo-router";
import { Home, Search, Plus, User, Briefcase } from "lucide-react-native";

export default function Index() {
  return (
    <ScrollView className="flex-1 bg-background">
      <View className="px-6 pt-16 pb-8">
        <Text className="text-3xl font-bold text-text">Jobblo</Text>
        <Text className="text-muted mt-2">Find your next gig</Text>
      </View>

      <View className="px-6 space-y-4">
        <View className="p-5 rounded-2xl bg-primary shadow-lg">
          <View className="flex-row items-center gap-3 mb-3">
            <Briefcase size={24} color="white" />
            <Text className="text-white text-lg font-semibold">Browse Jobs</Text>
          </View>
          <Text className="text-white/80 text-sm">
            Explore thousands of job listings near you
          </Text>
        </View>

        <View className="flex-row gap-4">
          <View className="flex-1 p-4 rounded-2xl bg-surface border border-border">
            <Search size={20} color="#64748B" />
            <Text className="text-text font-medium mt-3">Search</Text>
            <Text className="text-muted text-xs mt-1">Find work</Text>
          </View>
          <View className="flex-1 p-4 rounded-2xl bg-surface border border-border">
            <Plus size={20} color="#64748B" />
            <Text className="text-text font-medium mt-3">Post Job</Text>
            <Text className="text-muted text-xs mt-1">Hire workers</Text>
          </View>
        </View>

        <View className="p-4 rounded-2xl bg-surface border border-border">
          <Text className="text-text font-semibold mb-4">Categories</Text>
          <View className="flex-row flex-wrap gap-3">
            {["Cleaning", "Moving", "Gardening", "Painting", "Repair", "Delivery"].map(
              (cat) => (
                <View
                  key={cat}
                  className="px-4 py-2 rounded-full bg-background border border-border"
                >
                  <Text className="text-muted text-sm">{cat}</Text>
                </View>
              )
            )}
          </View>
        </View>

        <View className="flex-row justify-around py-6 mt-4 rounded-2xl bg-surface border border-border">
          <Link href="/">
            <View className="items-center gap-1">
              <Home size={22} color="#3B82F6" />
              <Text className="text-primary text-xs font-medium">Home</Text>
            </View>
          </Link>
          <View className="items-center gap-1">
            <Search size={22} color="#64748B" />
            <Text className="text-muted text-xs">Explore</Text>
          </View>
          <View className="items-center gap-1">
            <Plus size={22} color="#64748B" />
            <Text className="text-muted text-xs">Post</Text>
          </View>
          <View className="items-center gap-1">
            <User size={22} color="#64748B" />
            <Text className="text-muted text-xs">Profile</Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
