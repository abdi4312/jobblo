import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import {
  useList,
  useAddContributors,
  useRemoveContributor,
} from "../../../features/list/hooks/useLists";
import { ListUser } from "../../../features/list/types";
import { useSearchUsers } from "../../../features/user/hooks/useUsers";
import { useAuth } from "../../../context/AuthContext";

export default function ContributorsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const { data: list, isLoading, isError } = useList(id!);
  const addContributorsMutation = useAddContributors();
  const removeContributorMutation = useRemoveContributor();

  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  const { data: searchResults, isLoading: isSearching } =
    useSearchUsers(searchQuery);

  const handleAddContributors = () => {
    // Only proceed if there are changes to make
    const usersToAdd = selectedUsers.filter(
      (id) =>
        !contributors.some((c) => c._id === id) &&
        !owners.some((o) => o._id === id),
    );
    const usersToRemove = contributors
      .filter((c) => !selectedUsers.includes(c._id))
      .map((c) => c._id);

    if (usersToAdd.length === 0 && usersToRemove.length === 0) {
      setIsAddModalVisible(false);
      return;
    }

    // Since our backend has specific endpoints for add and remove, we might need to handle both
    // For simplicity, let's update the selection logic to handle immediate removal if preferred,
    // but here we'll follow the "Save" pattern of the modal.

    // We'll perform addContributors which typically handles the array sync in most implementations
    // or we can chain the calls. Let's assume addContributors handles the new state.
    addContributorsMutation.mutate(
      {
        listId: id!,
        userIds: selectedUsers, // Sending the full new list of contributor IDs
      },
      {
        onSuccess: () => {
          setIsAddModalVisible(false);
          setSearchQuery("");
        },
      },
    );
  };

  // Sync selectedUsers when modal opens or list changes
  React.useEffect(() => {
    if (isAddModalVisible && list) {
      const existingIds = contributors.map((c) => c._id);
      setSelectedUsers(existingIds);
    }
  }, [isAddModalVisible, list]);

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
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

  // Cast owners and contributors to ListUser arrays (they are populated by backend)
  const owners = (list.user as ListUser[]) || [];
  const contributors = (list.contributors as ListUser[]) || [];
  const isCurrentUserOwner = owners.some((o) => o._id === currentUser?._id);

  const handleRemoveContributor = (userId: string) => {
    removeContributorMutation.mutate({
      listId: id!,
      userId,
    });
  };

  const renderUserItem = (user: ListUser, isOwner: boolean = false) => (
    <View key={user._id} className="flex-row items-center px-4 py-3">
      <View className="w-12 h-12 bg-gray-100 rounded-full overflow-hidden mr-4">
        {user.avatarUrl ? (
          <Image
            source={{ uri: user.avatarUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-gray-400 font-bold">
              {user.name?.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>
      <View className="flex-1">
        <Text className="text-lg font-medium text-black">
          {user.name?.toLowerCase().replace(/\s/g, "")}{" "}
          {isOwner ? "(Owner)" : ""}
        </Text>
        <Text className="text-gray-400 text-sm">
          {user.name} {user.lastName || ""}
        </Text>
      </View>
      {isEditing && !isOwner && (
        <TouchableOpacity
          onPress={() => handleRemoveContributor(user._id)}
          className="ml-2"
        >
          <Ionicons name="remove-circle" size={28} color="#FF3B30" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 mb-4">
        <TouchableOpacity onPress={() => router.back()} className="w-10">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>

        <Text className="text-xl font-medium text-black flex-1 text-center">
          Contributors
        </Text>

        <View className="w-10 items-end">
          <TouchableOpacity onPress={() => setIsEditing(!isEditing)}>
            <Text className="text-[#800080] text-lg font-medium">
              {isEditing ? "Done" : "Edit"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Add Collaborator Modal */}
      <Modal
        visible={isAddModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddModalVisible(false)}
      >
        <View className="flex-1 bg-black/40 justify-end">
          <View className="bg-white rounded-t-[30px] h-[90%]">
            {/* Modal Header */}
            <View className="flex-row items-center justify-between px-6 py-6 border-b border-gray-100">
              <View className="flex-1" />
              <Text className="text-xl font-medium text-black flex-1 text-center">
                Add collaborator
              </Text>
              <TouchableOpacity
                onPress={() => setIsAddModalVisible(false)}
                className="flex-1 items-end"
              >
                <Text className="text-[#800080] text-lg font-medium">
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="px-4 py-4">
              <View className="flex-row items-center bg-gray-100 rounded-2xl px-4 py-3">
                <Ionicons name="search" size={20} color="#666" />
                <TextInput
                  className="flex-1 ml-3 text-lg text-black"
                  placeholder="Search"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoFocus={true}
                />
              </View>
            </View>

            {/* User List */}
            <ScrollView className="flex-1">
              {isSearching ? (
                <View className="py-10 items-center">
                  <ActivityIndicator color="#E68A2E" />
                </View>
              ) : (
                searchResults?.map((user) => {
                  const isOwner = owners.some((o) => o._id === user._id);
                  const isSelected = selectedUsers.includes(user._id);

                  return (
                    <TouchableOpacity
                      key={user._id}
                      onPress={() => !isOwner && toggleUserSelection(user._id)}
                      className="flex-row items-center px-6 py-4"
                      disabled={isOwner}
                    >
                      <View
                        className={`w-14 h-14 bg-gray-100 rounded-full overflow-hidden mr-4 ${isOwner ? "opacity-50" : ""}`}
                      >
                        {user.avatarUrl ? (
                          <Image
                            source={{ uri: user.avatarUrl }}
                            className="w-full h-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <View className="flex-1 items-center justify-center">
                            <Text className="text-gray-400 font-bold text-xl">
                              {user.name?.charAt(0).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`text-lg font-medium ${isOwner ? "text-gray-400" : "text-black"}`}
                        >
                          {user.name?.toLowerCase().replace(/\s/g, "")}
                          {isOwner ? " (Owner)" : ""}
                        </Text>
                        <Text className="text-gray-400">
                          {user.name} {user.lastName || ""}
                        </Text>
                      </View>
                      <View
                        className={`w-8 h-8 rounded-full border-2 items-center justify-center ${
                          isSelected
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-200"
                        }`}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={20} color="white" />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>

            {/* Footer Button */}
            <View className="px-4 py-6 border-t border-gray-100">
              <TouchableOpacity
                onPress={handleAddContributors}
                disabled={
                  selectedUsers.length === 0 ||
                  addContributorsMutation.isPending
                }
                className={`w-full py-4 rounded-3xl items-center ${
                  selectedUsers.length > 0 ? "bg-orange-200" : "bg-gray-100"
                }`}
              >
                {addContributorsMutation.isPending ? (
                  <ActivityIndicator color="#E68A2E" />
                ) : (
                  <Text
                    className={`text-lg font-bold ${
                      selectedUsers.length > 0
                        ? "text-[#E68A2E]"
                        : "text-gray-400"
                    }`}
                  >
                    Add collaborator
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Add Contributors Button */}
        <TouchableOpacity
          onPress={() => setIsAddModalVisible(true)}
          className="flex-row items-center px-4 py-4 mb-2"
        >
          <View className="w-12 h-12 bg-orange-50 rounded-full items-center justify-center mr-4">
            <Ionicons name="add" size={32} color="#E68A2E" />
          </View>
          <Text className="text-lg font-medium text-black">
            Add contributors
          </Text>
        </TouchableOpacity>

        {/* Owner Section */}
        {owners.map((owner) => renderUserItem(owner, true))}

        {/* Contributors Section */}
        {contributors.map((contributor) => renderUserItem(contributor))}
      </ScrollView>
    </SafeAreaView>
  );
}
