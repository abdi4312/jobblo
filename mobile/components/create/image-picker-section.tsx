import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureHandlerRootView,
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";

interface ImagePickerSectionProps {
  images: string[];
  setImages: (images: string[]) => void;
}

const ITEM_WIDTH = 110; // 96 (w-24) + 12 (mr-3)

const DraggableItem = ({
  uri,
  index,
  totalItems,
  onRemove,
  onSetMain,
  onSwap,
}: {
  uri: string;
  index: number;
  totalItems: number;
  onRemove: (index: number) => void;
  onSetMain: (index: number) => void;
  onSwap: (fromIndex: number, toIndex: number) => void;
}) => {
  const isDragging = useSharedValue(false);
  const offset = useSharedValue(0);

  const gesture = Gesture.Pan()
    .activateAfterLongPress(200)
    .onStart(() => {
      isDragging.value = true;
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
    })
    .onUpdate((event) => {
      offset.value = event.translationX;

      const newIndex = Math.round(index + offset.value / ITEM_WIDTH);
      if (newIndex !== index && newIndex >= 0 && newIndex < totalItems) {
        runOnJS(onSwap)(index, newIndex);
        offset.value = 0; // Reset offset after swap
      }
    })
    .onEnd(() => {
      isDragging.value = false;
      offset.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: offset.value },
      { scale: isDragging.value ? 1.1 : 1 },
    ],
    zIndex: isDragging.value ? 100 : 1,
    opacity: isDragging.value ? 0.9 : 1,
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[animatedStyle]} className="mr-3">
        <TouchableOpacity
          onLongPress={() => {}} // Needed for activateAfterLongPress
          onPress={() => onSetMain(index)}
          className={`relative rounded-xl overflow-hidden border-2 ${index === 0 ? "border-[#E68A2E]" : "border-transparent"}`}
          activeOpacity={0.7}
        >
          <Image source={{ uri }} className="w-24 h-24" />
          {index === 0 && (
            <View className="absolute inset-0 bg-[#E68A2E]/10 items-center justify-center">
              <Ionicons name="checkmark-circle" size={24} color="#E68A2E" />
            </View>
          )}
          <TouchableOpacity
            onPress={() => onRemove(index)}
            className="absolute top-1 right-1 bg-white/90 rounded-full shadow-sm p-0.5"
          >
            <Ionicons name="close" size={14} color="red" />
          </TouchableOpacity>
          {index !== 0 && (
            <View className="absolute bottom-0 left-0 right-0 bg-black/40 py-0.5">
              <Text className="text-[8px] text-white text-center font-bold">
                Set Main
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View className="mt-2 px-1 items-center">
          <Text className="text-[10px] font-bold text-gray-500">
            {index + 1}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
};

export const ImagePickerSection: React.FC<ImagePickerSectionProps> = ({
  images,
  setImages,
}) => {
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsMultipleSelection: true,
      selectionLimit: 6 - images.length,
      quality: 0.8,
    });

    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages([...images, ...newImages]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const setAsMainImage = (index: number) => {
    if (index === 0) return;
    const newImages = [...images];
    const [selectedImage] = newImages.splice(index, 1);
    newImages.unshift(selectedImage);
    setImages(newImages);
  };

  const moveImage = (index: number, direction: "left" | "right") => {
    const newImages = [...images];
    const newIndex = direction === "left" ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= images.length) return;

    // Swap images
    const temp = newImages[index];
    newImages[index] = newImages[newIndex];
    newImages[newIndex] = temp;

    setImages(newImages);
  };

  const onSwap = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= images.length) return;
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    setImages(newImages);
  };

  return (
    <GestureHandlerRootView>
      <View className="mb-8">
        <Text className="text-lg font-bold mb-4">
          Images{" "}
          <Text className="text-gray-400 font-normal text-sm">
            (Optional, max 6)
          </Text>
        </Text>

        {/* Main Image Box */}
        <View className="mb-4">
          {images.length > 0 ? (
            <View className="relative w-full h-48 rounded-2xl overflow-hidden bg-gray-100">
              <Image
                source={{ uri: images[0] }}
                className="w-full h-full"
                resizeMode="cover"
              />
              <View className="absolute top-3 left-3 bg-[#E68A2E] px-3 py-1 rounded-full shadow-sm">
                <Text className="text-white text-[10px] font-bold uppercase">
                  Main Image
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => removeImage(0)}
                className="absolute top-3 right-3 bg-white/80 p-1 rounded-full shadow-sm"
              >
                <Ionicons name="trash-outline" size={18} color="red" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickImage}
              className="w-full h-48 border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center bg-gray-50"
            >
              <Ionicons name="cloud-upload-outline" size={48} color="#999" />
              <Text className="text-gray-400 mt-2 text-sm font-medium">
                Upload Main Image
              </Text>
              <Text className="text-gray-300 text-[10px] mt-1">
                This will be shown as the cover
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Other Images List */}
        {images.length > 0 && (
          <View>
            <View className="flex-row justify-between items-center mb-3">
              <Text className="text-sm font-bold text-gray-700">
                All Images ({images.length}/6)
              </Text>
              {images.length < 6 && (
                <TouchableOpacity
                  onPress={pickImage}
                  className="flex-row items-center"
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={16}
                    color="#E68A2E"
                  />
                  <Text className="text-[#E68A2E] text-xs font-bold ml-1">
                    Add More
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="flex-row"
              scrollEnabled={true} // Allow scrolling when not dragging
            >
              {images.map((uri, index) => (
                <DraggableItem
                  key={uri} // Use URI as key for better tracking
                  uri={uri}
                  index={index}
                  totalItems={images.length}
                  onRemove={removeImage}
                  onSetMain={setAsMainImage}
                  onSwap={onSwap}
                />
              ))}
            </ScrollView>

            <Text className="text-gray-400 text-[10px] mt-4 text-center">
              Hold and drag to reorder images
            </Text>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
};
