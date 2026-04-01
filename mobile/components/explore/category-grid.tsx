import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as LucideIcons from 'lucide-react-native';
import { useCategories } from '../../features/category/hooks/useCategories';

export default function CategoryGrid() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();

  // Helper to render Lucide icons dynamically
  const CategoryIcon = ({ name, size = 32, color = '#333' }: { name: string; size?: number; color?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.HelpCircle;
    return <IconComponent size={size} color={color} strokeWidth={1.5} />;
  };

  return (
    <View className="mb-10">
      <Text className="text-2xl font-normal text-[#000000] mb-6 px-4">Shop by Category</Text>

      {categoriesLoading ? (
        <ActivityIndicator size="large" color="#E68A2E" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingLeft: 14, alignItems: 'center' }}
        >
          {categories?.map((category) => (
            <TouchableOpacity
              key={category._id}
              className="w-28 h-36 bg-[#F2F2F2] rounded-[20px] py-5 mr-2.5 items-center justify-center"
              style={{ elevation: 0 }}
            >
              <View className="mb-3">
                <CategoryIcon name={category.icon || 'HelpCircle'} size={40} />
              </View>
              <Text className="text-[#000000] font-normal text-center px-2 text-[12px]" numberOfLines={1}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
