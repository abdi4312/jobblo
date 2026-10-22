import React from 'react';
import { Text, View } from 'react-native';
import { MapPinOff } from 'lucide-react-native';

/** Shown in place of a MapView when the build has no map key (see MAPS_AVAILABLE). */
export function MapUnavailable() {
  return (
    <View className="flex-1 items-center justify-center gap-2 bg-[#F4F6F0] p-4">
      <MapPinOff size={22} color="#9B9E96" />
      <Text className="text-center text-[0.8125rem] text-[#63665F]">Kartet er ikke tilgjengelig i denne versjonen av appen.</Text>
    </View>
  );
}
