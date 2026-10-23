import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { Crosshair, Locate, MapPin } from 'lucide-react-native';
import MapView, { Marker, type LatLng, type MapPressEvent } from 'react-native-maps';
import * as Location from 'expo-location';
import { MAP_PROVIDER, MAPS_AVAILABLE } from '@/utils/mapProvider';
import { MapUnavailable } from '@/components/ui/MapUnavailable';
import { TC } from '../../theme/colors';

const DEFAULT_REGION = {
  latitude: 59.9127,
  longitude: 10.7461,
  latitudeDelta: 4.5,
  longitudeDelta: 7.5,
};

const confirmedCoordinate = (coordinates: [number, number]) =>
  coordinates[0] !== 0 || coordinates[1] !== 0;

interface CreateJobLocationMapProps {
  coordinates: [number, number];
  onCoordinatesChange: (coordinates: [number, number]) => void;
  error?: string;
}

export function CreateJobLocationMap({
  coordinates,
  onCoordinatesChange,
  error,
}: CreateJobLocationMapProps) {
  const mapRef = useRef<MapView | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const hasMarker = confirmedCoordinate(coordinates);

  const animateTo = (coordinate: LatLng) => {
    mapRef.current?.animateToRegion(
      {
        ...coordinate,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      500
    );
  };

  const selectCoordinate = (coordinate: LatLng) => {
    setLocationError('');
    onCoordinatesChange([coordinate.latitude, coordinate.longitude]);
    animateTo(coordinate);
  };

  useEffect(() => {
    if (hasMarker) {
      animateTo({ latitude: coordinates[0], longitude: coordinates[1] });
    }
    // The map only follows confirmed coordinates supplied by the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coordinates[0], coordinates[1]]);

  const useCurrentLocation = async () => {
    if (isLocating) return;
    setIsLocating(true);
    setLocationError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Posisjonstillatelse ble avslått. Du kan fortsatt trykke på kartet eller bekrefte adressen.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      selectCoordinate({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      Alert.alert(
        'Kunne ikke hente posisjon',
        'Sjekk at posisjonstjenester er slått på. Du kan fortsatt trykke på kartet eller bekrefte adressen.'
      );
    } finally {
      setIsLocating(false);
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    selectCoordinate(event.nativeEvent.coordinate);
  };

  return (
    <View className="gap-3">
      <View className="h-64 overflow-hidden rounded-lg border border-line bg-surface">
        {MAPS_AVAILABLE ? <MapView
          ref={mapRef}
          provider={MAP_PROVIDER}
          style={{ flex: 1 }}
          initialRegion={hasMarker ? {
            latitude: coordinates[0],
            longitude: coordinates[1],
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          } : DEFAULT_REGION}
          onPress={handleMapPress}
          showsCompass
          toolbarEnabled={false}
        >
          {hasMarker ? (
            <Marker
              coordinate={{ latitude: coordinates[0], longitude: coordinates[1] }}
              draggable
              onDragEnd={(event) => selectCoordinate(event.nativeEvent.coordinate)}
              title="Jobblokkasjon"
            />
          ) : null}
        </MapView> : <MapUnavailable />}
        {MAPS_AVAILABLE && !hasMarker && !isLocating ? (
          <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
            <View className="flex-row items-center gap-2 rounded-full border border-line bg-white/95 px-4 py-2">
              <Crosshair size={15} color={TC.brandText} />
              <Text className="text-[0.8125rem] font-semibold text-muted">Trykk på kartet for å sette lokasjon</Text>
            </View>
          </View>
        ) : null}
      </View>

      {error ? <Text className="text-[0.8125rem] font-medium text-danger"><MapPin size={12} color={TC.danger} /> {error}</Text> : null}
      {locationError ? <Text className="text-[0.8125rem] font-medium text-danger">{locationError}</Text> : null}
      <Pressable
        onPress={() => void useCurrentLocation()}
        disabled={isLocating}
        className="h-11 flex-row items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 disabled:opacity-60"
      >
        <Locate size={16} color={TC.brandText} />
        <Text className="text-sm font-semibold text-brand-text">
          {isLocating ? 'Henter posisjon...' : 'Bruk min nåværende posisjon'}
        </Text>
      </Pressable>
    </View>
  );
}

export default CreateJobLocationMap;
