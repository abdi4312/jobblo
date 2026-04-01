import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, ActivityIndicator, Dimensions } from 'react-native';
import { useHeroes } from '../../features/hero/hooks/useHeroes';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HeroSlider() {
  const { data: heroes, isLoading: heroesLoading } = useHeroes();
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);

  const onHeroScroll = (e: any) => {
    const slide = Math.ceil(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
    if (slide !== activeHeroIndex) setActiveHeroIndex(slide);
  };

  return (
    <View className="mb-8">
      {heroesLoading ? (
        <View className="h-64 justify-center">
          <ActivityIndicator color="#E68A2E" />
        </View>
      ) : heroes && heroes.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onHeroScroll}
            scrollEventThrottle={16}
          >
            {heroes.map((hero) => (
              <View key={hero._id} style={{ width: SCREEN_WIDTH }} className="px-4">
                <ImageBackground
                  source={{ uri: hero.image }}
                  className="h-64 rounded-[30px] overflow-hidden justify-center items-center p-6"
                  imageStyle={{ borderRadius: 30 }}
                >
                  <View className="absolute inset-0 bg-black/30" />
                  <Text className="text-white text-3xl font-bold text-center mb-4">
                    {hero.title}
                  </Text>
                  {hero.buttonText && (
                    <TouchableOpacity className="bg-white px-6 py-3 rounded-xl">
                      <Text className="text-black font-bold">{hero.buttonText}</Text>
                    </TouchableOpacity>
                  )}
                  {hero.footerText && (
                    <Text className="text-white/80 text-[10px] text-center absolute bottom-4 px-6">
                      {hero.footerText}
                    </Text>
                  )}
                </ImageBackground>
              </View>
            ))}
          </ScrollView>

          {/* Pagination Dots */}
          {heroes.length > 1 && (
            <View className="flex-row justify-center mt-4">
              {heroes.map((_, index) => (
                <View
                  key={index}
                  className={`w-2.5 h-2.5 rounded-full mx-1 ${index === activeHeroIndex ? 'bg-black' : 'bg-gray-300'
                    }`}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
