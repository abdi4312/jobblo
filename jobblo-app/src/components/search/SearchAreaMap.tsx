import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import MapView, { Circle, PROVIDER_GOOGLE, type LatLng, type Region } from 'react-native-maps';

export const NORWAY_SEARCH_CENTERS: Record<string, [number, number]> = {
  '03': [10.7522, 59.9139], '11': [5.7331, 58.97], '15': [6.3648, 62.472],
  '18': [14.3747, 67.2804], '31': [11.395, 59.52], '32': [10.2052, 60.7945],
  '33': [9.0568, 60.2729], '34': [10.808, 61.1155], '39': [10.2323, 59.2816],
  '40': [8.7277, 59.4358], '42': [7.9964, 58.1599], '46': [5.3329, 60.3913],
  '50': [10.3951, 63.4305], '55': [18.9551, 69.6492], '56': [23.2594, 70.0712],
  '0301': [10.7522, 59.9139], '1103': [5.7331, 58.97], '1201': [5.322, 60.3913],
  '1601': [10.3951, 63.4305], '0101': [11.3883, 59.2836], '0106': [11.067, 59.1286],
  '4204': [7.9964, 58.1599], '1001': [7.9964, 58.1599], '1004': [7.5945, 58.0788],
  '1014': [7.1699, 58.1], '4601': [5.322, 60.3913], '5001': [10.3951, 63.4305],
  '0401': [11.0688, 60.7945],
};

const DEFAULT_CENTER: LatLng = { latitude: 59.9139, longitude: 10.7522 };

function regionFor(center: LatLng, radius: number): Region {
  const delta = Math.max(0.08, Math.min(8, radius / 60000));
  return { ...center, latitudeDelta: delta, longitudeDelta: delta };
}

export function SearchAreaMap({ center, radius }: { center: [number, number]; radius: number }) {
  const mapRef = useRef<MapView | null>(null);
  const coordinate = { longitude: center[0], latitude: center[1] };
  const region = regionFor(coordinate, radius);

  useEffect(() => {
    mapRef.current?.animateToRegion(region, 350);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  return (
    <View className="relative h-52 overflow-hidden rounded-2xl border border-[#E6E7E1] bg-[#F4F6F0]">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={{ flex: 1 }}
        initialRegion={regionFor(DEFAULT_CENTER, 5000)}
        showsCompass
        showsUserLocation={false}
        showsMyLocationButton={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Circle
          center={coordinate}
          radius={radius}
          strokeColor="#2E6641"
          strokeWidth={2}
          fillColor="#2E6641"
        />
      </MapView>
      <View className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1">
        <Text className="text-[0.6875rem] font-semibold text-[#63665F]">Oppdrag nær deg</Text>
      </View>
    </View>
  );
}