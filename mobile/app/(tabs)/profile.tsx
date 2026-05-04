import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMyPostedJobs } from "../../features/job/hooks/useMyPostedJobs";
import JobCard from "../../components/explore/job-card/index";
import { ListGrid } from "../../components/explore/list-grid";

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"jobs" | "likes" | "saved">(
    "jobs",
  );

  const { data: myJobs, isLoading, error, refetch } = useMyPostedJobs();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  const renderJobGrid = () => {
    if (isLoading) {
      return (
        <View className="py-20 items-center">
          <ActivityIndicator color="#E68A2E" size="large" />
        </View>
      );
    }

    if (error) {
      return (
        <View className="py-20 items-center px-10">
          <Text className="text-red-500 text-center">Failed to load jobs</Text>
        </View>
      );
    }

    const jobs = Array.isArray(myJobs) ? myJobs : myJobs?.data || [];

    if (jobs.length === 0) {
      return (
        <View className="py-20 items-center px-10">
          <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4">
            <Ionicons name="briefcase-outline" size={40} color="#ccc" />
          </View>
          <Text className="text-gray-400 text-center">No jobs posted yet</Text>
        </View>
      );
    }

    return (
      <View className="flex-row flex-wrap px-4">
        {jobs.map((job) => (
          <View 
            key={job._id} 
            style={{ width: '48%', marginBottom: 16 }}
          >
            <JobCard
              item={job}
              onPress={() =>
                router.push({
                  pathname: "/job-search",
                  params: { id: job._id },
                })
              }
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
      {/* Header Bar */}
      <View className="flex-row justify-between items-center px-4 py-3">
        <TouchableOpacity>
          <Ionicons name="notifications-outline" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold">
          @{user?.name?.toLowerCase().replace(/\s/g, "") || "user"}
        </Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="settings-outline" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#E68A2E" // For iOS
            colors={["#E68A2E"]} // For Android
          />
        }
      >
        {/* Profile Info Section */}
        <View className="px-4 py-6 flex-row items-center">
          {/* Avatar */}
          <View className="relative">
            <View className="w-24 h-24 bg-gray-100 rounded-full items-center justify-center border-2 border-gray-50 overflow-hidden">
              {user?.avatarUrl ? (
                <Image
                  source={{ uri: user.avatarUrl }}
                  className="w-full h-full"
                />
              ) : (
                <Text className="text-3xl font-bold text-gray-400">
                  {user?.name?.charAt(0).toUpperCase() || "U"}
                </Text>
              )}
            </View>
          </View>

          {/* Stats */}
          <View className="flex-1 flex-row justify-around ml-4">
            <View className="items-center">
              <Text className="text-lg font-bold">1</Text>
              <Text className="text-xs text-gray-500">Streak</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold">0</Text>
              <Text className="text-xs text-gray-500">Followers</Text>
            </View>
            <View className="items-center">
              <Text className="text-lg font-bold">0</Text>
              <Text className="text-xs text-gray-500">Following</Text>
            </View>
          </View>
        </View>

        {/* Buttons Row */}
        <View className="flex-row px-4 mb-6">
          <TouchableOpacity className="flex-1 bg-gray-50 py-2.5 rounded-xl items-center mr-2 border border-gray-100">
            <Text className="font-bold text-gray-800">Reward</Text>
          </TouchableOpacity>
          <TouchableOpacity className="flex-1 bg-gray-50 py-2.5 rounded-xl items-center border border-gray-100">
            <Text className="font-bold text-gray-800">No Rating</Text>
          </TouchableOpacity>
        </View>

        {/* Name & Bio */}
        <View className="px-4 mb-8">
          <Text className="text-xl font-bold text-gray-900">
            {user?.name || "User Name"}
          </Text>
          <TouchableOpacity>
            <Text className="text-gray-400 mt-1">Press here to enter bio</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View className="flex-row border-b border-gray-100 mb-6">
          <TouchableOpacity
            onPress={() => setActiveTab("jobs")}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === "jobs" ? "border-black" : "border-transparent"
            }`}
          >
            <Ionicons
              name={activeTab === "jobs" ? "grid" : "grid-outline"}
              size={24}
              color={activeTab === "jobs" ? "black" : "#ccc"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("likes")}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === "likes" ? "border-black" : "border-transparent"
            }`}
          >
            <Ionicons
              name={activeTab === "likes" ? "heart" : "heart-outline"}
              size={24}
              color={activeTab === "likes" ? "black" : "#ccc"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("saved")}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === "saved" ? "border-black" : "border-transparent"
            }`}
          >
            <Ionicons
              name={activeTab === "saved" ? "bookmark" : "bookmark-outline"}
              size={24}
              color={activeTab === "saved" ? "black" : "#ccc"}
            />
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === "jobs" ? (
          renderJobGrid()
        ) : activeTab === "saved" ? (
          <ListGrid hideTitle={true} />
        ) : (
          <View className="py-20 items-center">
            <Text className="text-gray-400">No {activeTab} yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
