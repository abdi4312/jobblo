import React from "react";
import { View, Text, TouchableOpacity, Image, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Job } from "../../../features/job/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Calculate width for 2 columns: (Screen - left/right padding - gap between items) / 2
const GRID_GAP = 12;
const SIDE_PADDING = 32; // 16px (px-4) * 2
const CALCULATED_CARD_WIDTH = (SCREEN_WIDTH - SIDE_PADDING - GRID_GAP) / 2;
const CARD_HEIGHT = CALCULATED_CARD_WIDTH * (200 / 192); // Maintaining the 192:200 ratio

interface JobCardProps {
  item: Job;
  onPress?: (job: Job) => void;
}

const JobCard: React.FC<JobCardProps> = ({ item, onPress }) => {
  return (
    <TouchableOpacity
      className="mb-6"
      style={{ width: CALCULATED_CARD_WIDTH }}
      onPress={() => onPress?.(item)}
    >
      {/* Image Container: w:CALCULATED_CARD_WIDTH, h:CARD_HEIGHT */}
      <View
        className="bg-[#0000001A] rounded-[20px] overflow-hidden relative mb-1.5"
        style={{ width: CALCULATED_CARD_WIDTH, height: CARD_HEIGHT }}
      >
        {item.images && item.images.length > 0 ? (
          <Image
            source={{ uri: item.images[0] }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={40} color="#CCC" />
          </View>
        )}

        {/* Category Tag */}
        {item.categories && item.categories.length > 0 && (
          <View className="absolute bottom-3 left-3 bg-[#E68A2E] px-3 py-1 rounded-full">
            <Text className="text-white text-[10px] font-medium">
              {item.categories[0]}
            </Text>
          </View>
        )}
      </View>

      {/* Title */}
      <Text
        className="text-[#0A0A0A] text-base font-medium mb-1 px-1"
        numberOfLines={1}
      >
        {item.title}
      </Text>

      {/* Footer */}
      <View className="flex-row justify-between items-center px-1">
        <Text className="text-[#0A0A0A99] text-xs font-normal">
          {item.location?.city || "Oslo"}
        </Text>
      </View>

      <View className="flex-row flex-wrap items-end justify-end px-1">
        <Text className="text-[#0A0A0A] text-base font-semibold">
          NOK {item.price}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default JobCard;
