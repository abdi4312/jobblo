import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useCategories } from "../../features/category/hooks/useCategories";

interface CategoryPickerSectionProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

export const CategoryPickerSection: React.FC<CategoryPickerSectionProps> = ({
  selectedCategory,
  setSelectedCategory,
}) => {
  const { data: categories } = useCategories();

  const toggleCategory = (catName: string) => {
    if (selectedCategory === catName) {
      setSelectedCategory("");
    } else {
      setSelectedCategory(catName);
    }
  };

  return (
    <View className="mb-8">
      <Text className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">
        Basic Information
      </Text>

      <Text className="text-sm font-bold mb-4">Category</Text>
      <View className="flex-row flex-wrap">
        {categories?.map((cat) => (
          <TouchableOpacity
            key={cat._id}
            onPress={() => toggleCategory(cat.name)}
            className={`px-4 py-2 rounded-lg border mr-2 mb-2 ${
              selectedCategory === cat.name
                ? "bg-orange-50 border-orange-500"
                : "bg-white border-gray-200"
            }`}
          >
            <Text
              className={`text-sm ${
                selectedCategory === cat.name
                  ? "text-orange-600"
                  : "text-gray-600"
              }`}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
