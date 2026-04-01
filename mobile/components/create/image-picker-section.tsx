import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

interface ImagePickerSectionProps {
  images: string[];
  setImages: (images: string[]) => void;
}

export const ImagePickerSection: React.FC<ImagePickerSectionProps> = ({ images, setImages }) => {
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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

  return (
    <View className="mb-8">
      <Text className="text-lg font-bold mb-4">
        Images{' '}
        <Text className="text-gray-400 font-normal text-sm">
          (Optional, max 6)
        </Text>
      </Text>
      <TouchableOpacity
        onPress={pickImage}
        className="h-32 border-2 border-dashed border-gray-200 rounded-2xl items-center justify-center bg-gray-50"
      >
        <Ionicons name="cloud-upload-outline" size={32} color="#999" />
        <Text className="text-gray-400 mt-2 text-xs">Upload</Text>
      </TouchableOpacity>
      {images.length > 0 && (
        <ScrollView
          horizontal
          className="mt-4"
          showsHorizontalScrollIndicator={false}
        >
          {images.map((uri, index) => (
            <View key={index} className="mr-3 relative">
              <Image source={{ uri }} className="w-20 h-20 rounded-xl" />
              <TouchableOpacity
                onPress={() => removeImage(index)}
                className="absolute -top-2 -right-2 bg-white rounded-full shadow-sm"
              >
                <Ionicons name="close-circle" size={20} color="red" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
};
