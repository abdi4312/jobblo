import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useList } from "../../features/list/hooks/useLists";
import JobCard from "../../components/explore/job-card/index";
import { Job } from "../../features/job/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: list, isLoading, isError } = useList(id!);
  const [viewType, setViewType] = useState<"grid" | "list">("grid");

  if (isLoading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator color="#E68A2E" size="large" />
      </View>
    );
  }

  if (isError || !list) {
    return (
      <View className="flex-1 bg-white items-center justify-center p-10">
        <Text className="text-red-500 text-center">Error loading list</Text>
        <TouchableOpacity
          className="mt-4 bg-[#E68A2E] px-6 py-2 rounded-full"
          onPress={() => router.back()}
        >
          <Text className="text-white font-bold">Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const services = (list.services as Job[]) || [];
  const imageUrl =
    services.length > 0
      ? services[0].images?.[0]
      : "https://via.placeholder.com/300";

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text className="text-lg font-bold">{list.name}</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="black" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile/Stats Section */}
        <View className="px-4 py-6 flex-row items-start">
          {/* List Cover */}
          <View className="w-32 h-32 bg-gray-100 rounded-[20px] overflow-hidden border border-gray-100">
            <Image
              source={{ uri: imageUrl || "https://via.placeholder.com/300" }}
              className="w-full h-full"
              resizeMode="cover"
            />
          </View>

          {/* Stats & Action */}
          <View className="flex-1 ml-6">
            <View className="flex-row justify-between mb-6">
              <View className="items-center">
                <Text className="text-lg font-bold">1</Text>
                <Text className="text-xs text-gray-500">Streak</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold">
                  {list.contributors?.length || 0}
                </Text>
                <Text className="text-xs text-gray-500">Contributors</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold">
                  {list.followers?.length || 0}
                </Text>
                <Text className="text-xs text-gray-500">Followers</Text>
              </View>
            </View>

            <TouchableOpacity
              className={`${list.public ? "bg-gray-100" : "bg-[#E68A2E]"} py-3 rounded-xl items-center shadow-sm`}
              activeOpacity={0.8}
            >
              <Text
                className={`${list.public ? "text-gray-800" : "text-white"} font-bold`}
              >
                {list.public ? "Make private" : "Make public"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* View Tabs */}
        <View className="flex-row border-b border-gray-100 mb-6">
          <TouchableOpacity
            onPress={() => setViewType("grid")}
            className={`flex-1 py-4 items-center border-b-2 ${viewType === "grid" ? "border-black" : "border-transparent"}`}
          >
            <Ionicons
              name="grid-outline"
              size={24}
              color={viewType === "grid" ? "black" : "#ccc"}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewType("list")}
            className={`flex-1 py-4 items-center border-b-2 ${viewType === "list" ? "border-black" : "border-transparent"}`}
          >
            <Ionicons
              name="menu-outline"
              size={24}
              color={viewType === "list" ? "black" : "#ccc"}
            />
          </TouchableOpacity>
        </View>

        {/* List Items */}
        {services.length === 0 ? (
          <View className="py-20 items-center">
            <Ionicons name="briefcase-outline" size={60} color="#ddd" />
            <Text className="text-gray-400 mt-4 text-lg">
              No items in this list
            </Text>
          </View>
        ) : (
          <View className="flex-row flex-wrap justify-between px-4 pb-20">
            {services.map((job) => (
              <JobCard
                key={job._id}
                item={job}
                onPress={() =>
                  router.push({
                    pathname: "/job-search",
                    params: { id: job._id },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
