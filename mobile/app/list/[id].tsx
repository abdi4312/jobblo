import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  Modal,
  Alert,
  Pressable,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  useList,
  useUpdateList,
  useDeleteList,
} from "../../features/list/hooks/useLists";
import JobCard from "../../components/explore/job-card/index";
import { Job } from "../../features/job/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: list, isLoading, isError } = useList(id!);
  const updateListMutation = useUpdateList();
  const deleteListMutation = useDeleteList();
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isEditNameVisible, setIsEditNameVisible] = useState(false);
  const [isEditDescVisible, setIsEditDescVisible] = useState(false);
  const [tempName, setTempName] = useState("");
  const [tempDesc, setTempDesc] = useState("");

  const handleTogglePublic = () => {
    if (!list) return;
    updateListMutation.mutate({
      listId: list._id,
      data: { public: !list.public },
    });
    setIsMenuVisible(false);
  };

  const handleSaveName = () => {
    if (!list || !tempName.trim()) return;
    updateListMutation.mutate(
      {
        listId: list._id,
        data: { name: tempName.trim() },
      },
      {
        onSuccess: () => {
          setIsEditNameVisible(false);
        },
      },
    );
  };

  const handleSaveDesc = () => {
    if (!list) return;
    updateListMutation.mutate(
      {
        listId: list._id,
        data: { description: tempDesc.trim() },
      },
      {
        onSuccess: () => {
          setIsEditDescVisible(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!list) return;
    Alert.alert("Delete List", "Are you sure you want to delete this list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteListMutation.mutate(list._id, {
            onSuccess: () => {
              router.replace("/(tabs)/profile");
            },
          });
        },
      },
    ]);
    setIsMenuVisible(false);
  };

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
        <TouchableOpacity onPress={() => setIsMenuVisible(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color="black" />
        </TouchableOpacity>
      </View>

      {/* Dropdown Menu Modal */}
      <Modal
        visible={isMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsMenuVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/20"
          onPress={() => setIsMenuVisible(false)}
        >
          <View
            className="absolute top-16 right-4 bg-white rounded-xl shadow-xl border border-gray-100 py-2 min-w-[200px]"
            style={{ elevation: 5 }}
          >
            <TouchableOpacity
              onPress={handleDelete}
              className="px-6 py-4 flex-row items-center border-b border-gray-50"
            >
              <Text className="text-red-500 text-base">Delete</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTempName(list.name);
                setIsEditNameVisible(true);
                setIsMenuVisible(false);
              }}
              className="px-6 py-4 border-b border-gray-50"
            >
              <Text className="text-gray-800 text-base">Change name</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTempDesc(list.description || "");
                setIsEditDescVisible(true);
                setIsMenuVisible(false);
              }}
              className="px-6 py-4 border-b border-gray-50"
            >
              <Text className="text-gray-800 text-base">
                Change list description
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleTogglePublic}
              className="px-6 py-4 border-b border-gray-50"
            >
              <Text className="text-gray-800 text-base">
                {list.public ? "Make private" : "Make public"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setIsMenuVisible(false);
                router.push(`/list/contributors/${id}`);
              }}
              className="px-6 py-4 border-b border-gray-50"
            >
              <Text className="text-gray-800 text-base">Contributors</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setIsMenuVisible(false)}
              className="px-6 py-4"
            >
              <Text className="text-gray-800 text-base">Share</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Edit Name Modal */}
      <Modal
        visible={isEditNameVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditNameVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center"
          onPress={() => setIsEditNameVisible(false)}
        >
          <Pressable
            className="bg-white rounded-[30px] p-8 w-[85%] shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-3xl font-medium text-gray-900 mb-6">
              New name
            </Text>
            <TextInput
              className="text-lg text-gray-800 border-b border-gray-200 pb-2 mb-8"
              value={tempName}
              onChangeText={setTempName}
              autoFocus={true}
              placeholder="Enter list name"
            />
            <View className="flex-row justify-end space-x-8">
              <TouchableOpacity onPress={() => setIsEditNameVisible(false)}>
                <Text className="text-[#800080] text-lg font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={updateListMutation.isPending}
              >
                {updateListMutation.isPending ? (
                  <ActivityIndicator color="#800080" />
                ) : (
                  <Text className="text-[#800080] text-lg font-medium">
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Description Modal */}
      <Modal
        visible={isEditDescVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsEditDescVisible(false)}
      >
        <Pressable
          className="flex-1 bg-black/40 items-center justify-center"
          onPress={() => setIsEditDescVisible(false)}
        >
          <Pressable
            className="bg-white rounded-[30px] p-8 w-[85%] shadow-2xl"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-3xl font-medium text-gray-900 mb-6">
              New description
            </Text>
            <TextInput
              className="text-lg text-gray-800 border-b border-gray-200 pb-2 mb-8"
              value={tempDesc}
              onChangeText={setTempDesc}
              autoFocus={true}
              multiline={true}
              placeholder="Enter list description"
            />
            <View className="flex-row justify-end space-x-8">
              <TouchableOpacity onPress={() => setIsEditDescVisible(false)}>
                <Text className="text-[#800080] text-lg font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveDesc}
                disabled={updateListMutation.isPending}
              >
                {updateListMutation.isPending ? (
                  <ActivityIndicator color="#800080" />
                ) : (
                  <Text className="text-[#800080] text-lg font-medium">
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
              <TouchableOpacity
                onPress={() => router.push(`/list/contributors/${id}`)}
                className="items-center"
              >
                <Text className="text-lg font-bold">
                  {list.contributors?.length || 0}
                </Text>
                <Text className="text-xs text-gray-500">Contributors</Text>
              </TouchableOpacity>
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
              onPress={handleTogglePublic}
              disabled={updateListMutation.isPending}
            >
              {updateListMutation.isPending ? (
                <ActivityIndicator color={list.public ? "#333" : "white"} />
              ) : (
                <Text
                  className={`${list.public ? "text-gray-800" : "text-white"} font-bold`}
                >
                  {list.public ? "Make private" : "Make public"}
                </Text>
              )}
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
