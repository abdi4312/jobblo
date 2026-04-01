import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useInfiniteJobs } from "../../features/job/hooks/useInfiniteJobs";
import { useAuth } from "../../context/AuthContext";
import JobCard from "../../components/explore/job-card/index";

export default function JobSearchScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { initialCategory } = useLocalSearchParams<{
    initialCategory: string;
  }>();
  const [search, setSearch] = useState("");

  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteJobs({
    limit: 10,
    search,
    category: initialCategory,
  });

  const jobs = data?.pages.flatMap((page) => page.data) || [];

  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: any) => {
    const paddingToBottom = 20;
    return (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    );
  };

  const handleScroll = (event: any) => {
    if (
      isCloseToBottom(event.nativeEvent) &&
      hasNextPage &&
      !isFetchingNextPage
    ) {
      fetchNextPage();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header with Back & Search */}
      <View className="flex-row items-center px-4 py-2 mt-2">
        {!user && (
          <TouchableOpacity onPress={() => router.back()} className="mr-3">
            <Ionicons name="arrow-back" size={24} color="black" />
          </TouchableOpacity>
        )}

        <View className="flex-1 flex-row items-center bg-gray-100 rounded-full px-4 py-2.5 border border-gray-200">
          <Ionicons name="search" size={20} color="#E68A2E" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-800"
            placeholder="Search all jobs..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
            autoFocus={true}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")} className="ml-2">
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {!user && (
          <TouchableOpacity
            onPress={() => router.replace("/login")}
            className="ml-3"
          >
            <Text className="text-orange-500 font-bold">Login</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Categories Indicator if filtered */}
      {initialCategory && (
        <View className="px-4 py-2 flex-row items-center">
          <View className="bg-orange-100 px-3 py-1 rounded-full flex-row items-center border border-orange-200">
            <Text className="text-orange-600 text-xs font-medium mr-1">
              {initialCategory}
            </Text>
            <TouchableOpacity
              onPress={() => router.setParams({ initialCategory: "" })}
            >
              <Ionicons name="close-circle" size={14} color="#E68A2E" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        className="flex-1 mt-4"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View className="py-20 items-center">
            <ActivityIndicator size="large" color="#E68A2E" />
          </View>
        ) : isError ? (
          <View className="py-20 items-center px-10">
            <Text className="text-red-500 text-center">
              Something went wrong. Please try again.
            </Text>
          </View>
        ) : (
          <>
            {/* Jobs Grid */}
            <View className="flex-row flex-wrap justify-between px-4">
              {jobs.map((job) => (
                <JobCard key={job._id} item={job} />
              ))}
            </View>

            {/* Empty State */}
            {jobs.length === 0 && (
              <View className="py-20 items-center">
                <Ionicons name="search-outline" size={60} color="#ddd" />
                <Text className="text-gray-400 mt-4 text-lg">
                  No results found
                </Text>
              </View>
            )}

            {/* Bottom Loading */}
            {isFetchingNextPage && (
              <View className="py-6 items-center">
                <ActivityIndicator color="#2D7A4D" />
              </View>
            )}

            <View className="h-24" />
          </>
        )}
      </ScrollView>

      {/* Floating Sort/Filter Bar */}
      <View className="absolute bottom-8 left-0 right-0 items-center">
        <View className="flex-row bg-white rounded-full px-6 py-3.5 shadow-lg border border-gray-100 elevation-5">
          <TouchableOpacity className="flex-row items-center border-r border-gray-200 pr-4">
            <Text className="text-gray-900 font-bold mr-2">Sort</Text>
            <Ionicons name="swap-vertical" size={18} color="black" />
          </TouchableOpacity>

          <TouchableOpacity className="flex-row items-center pl-4">
            <Ionicons name="options-outline" size={18} color="black" />
            <Text className="text-gray-900 font-bold ml-2">Filter</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
