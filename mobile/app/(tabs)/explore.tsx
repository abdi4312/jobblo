import React from "react";
import { View, Text, TextInput, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import ServicePicks from "../../components/explore/service-picks";
import ExploreJobs from "../../components/explore/explore-jobs";
import CategoryGrid from "../../components/explore/category-grid";
import HeroSlider from "../../components/explore/hero-slider";

export default function ExploreScreen() {
  // Reference for the ExploreJobs scroll listener
  const exploreJobsRef = React.useRef<any>(null);

  const isCloseToBottom = ({
    layoutMeasurement,
    contentOffset,
    contentSize,
  }: any) => {
    const paddingToBottom = 20;
    return (
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom
    );
  };

  const handleScroll = (event: any) => {
    // Infinite scroll logic
    if (isCloseToBottom(event.nativeEvent)) {
      exploreJobsRef.current?.loadMore?.();
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Header */}
        <View className="mt-6 mb-4 p-4">
          <Text className="text-4xl font-normal text-[#000000]">Discover</Text>
        </View>

        {/* Search Bar */}
        <View className="flex-row items-center bg-[#F2F2F2] rounded-[15px] px-4 py-2 mx-4 mb-6">
          <Ionicons name="search-outline" size={20} color="#3C3C4399" />
          <TextInput
            className="flex-1 ml-3 text-base text-[#3C3C4399]"
            placeholder="Search"
            placeholderTextColor="#3C3C4399"
          />
        </View>

        {/* Shop by Category Section */}
        <CategoryGrid />

        {/* Hero Slider Section */}
        <HeroSlider />

        {/* Our Services Picks Section */}
        <ServicePicks />

        {/* Explore Jobs Section */}
        <ExploreJobs ref={exploreJobsRef} />
      </ScrollView>
    </SafeAreaView>
  );
}
