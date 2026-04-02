import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useLists } from "../../features/list/hooks/useLists";
import { List } from "../../features/list/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_GAP = 12;
const SIDE_PADDING = 32; // px-4 * 2
const CALCULATED_CARD_WIDTH = (SCREEN_WIDTH - SIDE_PADDING - GRID_GAP) / 2;
// Aspect ratio for the Pinterest-style grid - 1:1.25 or similar
const CARD_HEIGHT = CALCULATED_CARD_WIDTH * 1.25;

const ListCard: React.FC<{ item: List }> = ({ item }) => {
  const router = useRouter();

  // Use the image from the latest service or a placeholder
  const latestJob =
    item.services &&
    item.services.length > 0 &&
    typeof item.services[0] === "object"
      ? (item.services[0] as any)
      : item.latestservice;

  const imageUrl = latestJob?.images?.[0] || "https://via.placeholder.com/300";

  return (
    <TouchableOpacity
      className="mb-4 rounded-[30px] overflow-hidden bg-gray-100"
      style={{ width: CALCULATED_CARD_WIDTH, height: CARD_HEIGHT }}
      onPress={() => router.push({ pathname: `/list/${item._id}` })}
      activeOpacity={0.8}
    >
      <Image
        source={{ uri: imageUrl }}
        className="w-full h-full absolute inset-0"
        resizeMode="cover"
      />

      {/* Overlay for text readability */}
      <View className="absolute inset-0 bg-black/10" />

      {/* Label at bottom-left */}
      <View className="absolute bottom-6 left-6">
        <Text
          className="text-white text-xl font-medium"
          style={{
            textShadowColor: "rgba(0, 0, 0, 0.4)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {item.name}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export const ListGrid: React.FC<{ hideTitle?: boolean }> = ({ hideTitle }) => {
  const { data: lists, isLoading, isError } = useLists();

  if (isLoading) {
    return (
      <View className="py-10 items-center">
        <ActivityIndicator color="#E68A2E" size="large" />
      </View>
    );
  }

  if (isError || !lists || lists.length === 0) {
    return null;
  }

  return (
    <View className="mb-10 px-4">
      {!hideTitle && (
        <View className="mb-4">
          <Text className="text-2xl font-normal text-black">Lists</Text>
        </View>
      )}
      <View className="flex-row flex-wrap justify-between">
        {lists.map((list) => (
          <ListCard key={list._id} item={list} />
        ))}
      </View>
    </View>
  );
};
