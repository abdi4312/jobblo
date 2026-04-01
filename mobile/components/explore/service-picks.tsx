import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const MOCK_SERVICES = [
    {
        id: '1',
        title: 'Moving Made Easy',
        image: 'https://images.unsplash.com/photo-1600518464441-9154a4dea21b?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '2',
        title: 'Home & Office Cleaning',
        image: 'https://static.tise.com/69c9054c764957bcb3e34af7/image0/8ad5be19-03a9-4117-a0bf-4df83fb1a665/sort-barbour-jakke',
    },
    {
        id: '3',
        title: 'Plumbing Repair',
        image: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '4',
        title: 'Electrical Work',
        image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '5',
        title: 'Gardening & Maintenance',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '6',
        title: 'Painting Services',
        image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '7',
        title: 'Furniture Assembly',
        image: 'https://images.unsplash.com/photo-1595428774223-ef52624120d2?q=80&w=1000&auto=format&fit=crop',
    },
    {
        id: '8',
        title: 'Car Wash & Detail',
        image: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?q=80&w=1000&auto=format&fit=crop',
    },
];

export default function ServicePicks() {
    // Group services into pairs (top and bottom) for each column
    const pairedServices = [];
    for (let i = 0; i < MOCK_SERVICES.length; i += 2) {
        pairedServices.push(MOCK_SERVICES.slice(i, i + 2));
    }

    const renderCard = (item: typeof MOCK_SERVICES[0], isBottom = false) => (
        <TouchableOpacity key={item.id} className={`${isBottom ? '' : 'mb-4'}`}>
            <ImageBackground
                source={{ uri: item.image }}
                className="w-40 h-52 rounded-[20px] overflow-hidden justify-center items-center p-4"
                imageStyle={{ borderRadius: 20 }}
            >
                <View className="absolute inset-0 bg-black/20" />
                <Text className="text-white text-[16px] font-medium text-center">
                    {item.title}
                </Text>
            </ImageBackground>
        </TouchableOpacity>
    );

    return (
        <View className="mb-10">
            {/* Title Section */}
            <View className="px-4 mb-6">
                <Text className="text-2xl font-normal text-[#000000]">Our Services Picks</Text>
                <Text className="text-[#9E9E9E] text-[12px] font-light mt-2">Popular services tailored for your needs</Text>
            </View>

            {/* Horizontal Scrollable Grid with unique items */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingLeft: 16, paddingRight: 8 }}
            >
                {pairedServices.map((pair, index) => (
                    <View key={index} className="mr-4">
                        {pair.map((item, subIndex) => renderCard(item, subIndex === 1))}
                    </View>
                ))}
            </ScrollView>
        </View>
    );
}
