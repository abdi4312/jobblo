import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Crosshair, MapPinHouse } from 'lucide-react-native';
import MapView, {
  LatLng,
  MapPressEvent,
  Marker,
  MarkerDragStartEndEvent,
  Region,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { MAP_PROVIDER, MAPS_AVAILABLE } from '../../../../src/utils/mapProvider';
import { MapUnavailable } from '../../../../src/components/ui/MapUnavailable';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import { Card, SectionLabel } from '../../../../src/components/ui/Card';
import { FormRow } from '../../../../src/components/ui/FormRow';
import type { CurrentProfile } from '../../../../src/services/profile.service';
import { TC } from '../../../../src/theme/colors';

type Draft = { address: string; postNumber: string; postSted: string };

const text = (value: unknown) => (typeof value === 'string' ? value : '');
const draftFrom = (profile: CurrentProfile): Draft => ({
  address: text(profile.address),
  postNumber: text(profile.postNumber),
  postSted:
    typeof profile.postSted === 'object' &&
    profile.postSted &&
    typeof profile.postSted.city === 'string'
      ? profile.postSted.city
      : text(profile.postSted),
});
const same = (a: Draft, b: Draft) =>
  a.address.trim() === b.address.trim() &&
  a.postNumber === b.postNumber &&
  a.postSted.trim() === b.postSted.trim();

const digitsOnly = (value: string, max?: number): string => {
  const digits = (value || '').replace(/\D/g, '');
  return typeof max === 'number' ? digits.slice(0, max) : digits;
};
const formatPostalCode = (value: string): string => digitsOnly(value, 4);
const isValidPostalCode = (value: string): boolean => /^\d{4}$/.test(digitsOnly(value, 4));

function errorMessage(error: unknown) {
  const response = (error as { response?: { status?: number; data?: { error?: string } } })
    ?.response;
  if (response?.status === 403) return 'Du har ikke tilgang til å endre denne brukeren.';
  if (response?.status === 400) return response.data?.error || 'Kontroller feltene og prøv igjen.';
  if (response?.status === 404) return 'Brukeren finnes ikke lenger.';
  return 'Kunne ikke lagre adressene. Sjekk internettforbindelsen og prøv igjen.';
}

const DEFAULT_REGION: Region = {
  latitude: 59.911491,
  longitude: 10.757933,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

type PermissionState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'granted' }
  | { status: 'denied' }
  | { status: 'unsupported' };

export default function AddressesSettingsScreen() {
  const router = useRouter();
  const { data: profile, isLoading, isError, refetch } = useProfile();
  const update = useUpdateProfile();
  const userId = useAuthStore((state: { user?: { _id?: unknown } | null }) =>
    typeof state.user?._id === 'string' ? state.user._id : undefined
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [original, setOriginal] = useState<Draft | null>(null);

  const mapRef = useRef<MapView | null>(null);
  const watcherRef = useRef<Location.LocationSubscription | null>(null);
  const locatingRef = useRef(false);

  const [permission, setPermission] = useState<PermissionState>({ status: 'idle' });
  const [currentDeviceLocation, setCurrentDeviceLocation] = useState<LatLng | null>(null);
  const [selectedCoordinate, setSelectedCoordinate] = useState<LatLng | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    if (profile && !draft) {
      const next = draftFrom(profile);
      setDraft(next);
      setOriginal(next);
    }
  }, [profile, draft]);

  useEffect(() => {
    void (async () => {
      setPermission({ status: 'checking' });
      try {
        const existing = await Location.getForegroundPermissionsAsync();
        if (existing.granted) {
          setPermission({ status: 'granted' });
          try {
            const now = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            });
            const coord = { latitude: now.coords.latitude, longitude: now.coords.longitude };
            setCurrentDeviceLocation(coord);
            if (!selectedCoordinate) {
              setSelectedCoordinate(coord);
              animateTo(coord);
            }
          } catch {
            // GPS unavailable — fall through, user can still tap the map
          }
          try {
            watcherRef.current?.remove();
            watcherRef.current = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.Balanced,
                distanceInterval: 10,
                timeInterval: 5000,
              },
              (loc) => {
                setCurrentDeviceLocation({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                });
              }
            );
          } catch {
            // watcher is best-effort; showsUserLocation may still work
          }
        } else if (existing.canAskAgain === false && existing.status !== 'granted') {
          setPermission({ status: 'denied' });
        } else {
          setPermission({ status: 'idle' });
        }
      } catch {
        setPermission({ status: 'unsupported' });
      }
    })();

    return () => {
      watcherRef.current?.remove();
      watcherRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dirty = !!draft && !!original && !same(draft, original);
  const postNumberProvidedButInvalid =
    !!draft && draft.postNumber.length > 0 && !isValidPostalCode(draft.postNumber);
  const validation = postNumberProvidedButInvalid
    ? 'Postnummer må være 4 siffer (f.eks. 0150).'
    : '';
  const canSave = !!userId && dirty && !validation && !update.isPending;

  const permissionMessage = useMemo(() => {
    if (permission.status === 'denied')
      return 'Posisjonstilgang er ikke aktivert. Du kan fortsatt skrive inn adressen manuelt.';
    if (permission.status === 'unsupported')
      return 'Posisjonstjenester er ikke tilgjengelige. Du kan fortsatt skrive inn adressen manuelt.';
    return '';
  }, [permission]);

  const animateTo = (coord: LatLng) => {
    try {
      mapRef.current?.animateToRegion(
        {
          latitude: coord.latitude,
          longitude: coord.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        },
        600
      );
    } catch {
      // ignore animation failures
    }
  };

  const applyReverseGeocodeResult = async (coord: LatLng) => {
    setIsGeocoding(true);
    try {
      const results = await Location.reverseGeocodeAsync(coord);
      const hit = results[0];
      if (hit && draft) {
        const street = (
          hit.street && hit.name ? `${hit.street} ${hit.name}` : hit.street || hit.name || ''
        ).trim();
        const post = formatPostalCode(hit.postalCode || '');
        const city = (hit.subregion || hit.city || hit.region || '').trim();
        setDraft((current) => {
          if (!current) return current;
          const next: Draft = { ...current };
          if (street) next.address = street;
          if (post) next.postNumber = post;
          if (city) next.postSted = city;
          return next;
        });
      }
    } catch {
      // reverse geocode failure is silent; manual entry still works
    } finally {
      setIsGeocoding(false);
    }
  };

  const locateAndUse = async () => {
    if (locatingRef.current) return;
    locatingRef.current = true;
    setIsLocating(true);
    try {
      if (permission.status !== 'granted') {
        setPermission({ status: 'checking' });
        const asked = await Location.requestForegroundPermissionsAsync();
        if (!asked.granted) {
          setPermission({ status: 'denied' });
          return;
        }
        setPermission({ status: 'granted' });
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setCurrentDeviceLocation(coord);
      setSelectedCoordinate(coord);
      animateTo(coord);
      await applyReverseGeocodeResult(coord);
    } catch {
      // GPS off or lookup failed
      Alert.alert(
        'Kunne ikke hente posisjon',
        'Sjekk at posisjonstjenester er slått på på enheten. Du kan fortsatt trykke på kartet eller skrive inn adressen manuelt.'
      );
    } finally {
      setIsLocating(false);
      locatingRef.current = false;
    }
  };

  const handleMapPress = (e: MapPressEvent) => {
    Keyboard.dismiss();
    const coord = e.nativeEvent.coordinate;
    setSelectedCoordinate({ latitude: coord.latitude, longitude: coord.longitude });
    void applyReverseGeocodeResult(coord);
  };

  const handleMarkerDragEnd = (e: MarkerDragStartEndEvent) => {
    const coord = e.nativeEvent.coordinate;
    setSelectedCoordinate({ latitude: coord.latitude, longitude: coord.longitude });
    void applyReverseGeocodeResult(coord);
  };

  if (isLoading || !draft) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <LoadingIndicator message="Laster adresser..." />
      </SafeAreaView>
    );
  }
  if (isError || !profile) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
        <ErrorState title="Kunne ikke laste adresser" onAction={() => void refetch()} />
      </SafeAreaView>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = () => {
    if (!userId || !original || !canSave) return;
    const changed: Record<string, string> = {};
    const trimmedAddress = draft.address.trim();
    const trimmedPostSted = draft.postSted.trim();
    const normalizedPostNumber = formatPostalCode(draft.postNumber);
    if (trimmedAddress !== original.address.trim()) changed.address = trimmedAddress;
    if (normalizedPostNumber !== original.postNumber) changed.postNumber = normalizedPostNumber;
    if (trimmedPostSted !== original.postSted.trim()) changed.postSted = trimmedPostSted;
    if (Object.keys(changed).length === 0) return;

    update.mutate(
      { userId, data: changed },
      {
        onSuccess: () => {
          const next: Draft = {
            address: trimmedAddress,
            postNumber: normalizedPostNumber,
            postSted: trimmedPostSted,
          };
          setOriginal(next);
          setDraft(next);
          Alert.alert('Adressene er lagret', 'Endringene dine er oppdatert.');
        },
        onError: (error: unknown) => Alert.alert('Kunne ikke lagre', errorMessage(error)),
      }
    );
  };

  const leave = () => {
    if (!dirty) return router.back();
    Alert.alert('Forkast endringer?', 'Endringene dine blir ikke lagret.', [
      { text: 'Fortsett å redigere', style: 'cancel' },
      { text: 'Forkast', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1 bg-page">
      {/* Top bar: Avbryt · title · Lagre, same as Rediger profil. */}
      <View className="h-14 flex-row items-center justify-between border-b border-line bg-page px-2">
        <Pressable onPress={leave} hitSlop={8} accessibilityRole="button" className="min-w-[72px] px-2 py-2">
          <Text className="text-[1rem] text-ink-2">Avbryt</Text>
        </Pressable>
        <Text className="text-[1.0625rem] font-semibold text-ink">Adresse</Text>
        <Pressable
          onPress={save}
          disabled={!canSave}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          className="min-w-[72px] items-end px-2 py-2"
        >
          {update.isPending ? (
            <ActivityIndicator size="small" color={TC.brandText} />
          ) : (
            <Text className={`text-[1rem] font-semibold ${canSave ? 'text-brand-text' : 'text-[#B5B8B0]'}`}>Lagre</Text>
          )}
        </Pressable>
      </View>

      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        >
          <Text className="mb-5 px-1 text-[0.875rem] leading-5 text-muted">
            Velg på kartet eller skriv inn adressen. Den lagres på Jobblo-kontoen din.
          </Text>

          {/* Map */}
          <SectionLabel>Velg på kartet</SectionLabel>
          <Card className="mb-6 overflow-hidden">
            <View style={{ height: 260 }} className="w-full bg-surface-2">
              {MAPS_AVAILABLE ? <MapView
                ref={mapRef}
                provider={MAP_PROVIDER}
                style={StyleSheet.absoluteFill}
                mapType="standard"
                // Uncontrolled: a `region` prop re-centred the map on every render, so it
                // snapped back whenever the user panned. animateTo() moves it on purpose.
                initialRegion={
                  selectedCoordinate
                    ? { ...selectedCoordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                    : DEFAULT_REGION
                }
                showsUserLocation={permission.status === 'granted'}
                showsMyLocationButton={false}
                showsCompass
                rotateEnabled={false}
                pitchEnabled={false}
                moveOnMarkerPress={false}
                onPress={handleMapPress}
              >
                {selectedCoordinate ? (
                  <Marker coordinate={selectedCoordinate} draggable onDragEnd={handleMarkerDragEnd} tracksViewChanges={false}>
                    <View className="items-center">
                      <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-brand">
                        <MapPinHouse size={18} color="#FFFFFF" />
                      </View>
                      <View className="h-2 w-2 rounded-full bg-brand" />
                    </View>
                  </Marker>
                ) : null}
              </MapView> : <MapUnavailable />}

              {isGeocoding ? (
                <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5" pointerEvents="none">
                  <ActivityIndicator size="small" color={TC.brandText} />
                  <Text className="text-[0.8125rem] font-medium text-ink-2">Finner adresse…</Text>
                </View>
              ) : null}
            </View>

            <View className="flex-row items-center gap-3 border-t border-line-soft px-4 py-3">
              <Text className="flex-1 text-[0.8125rem] leading-5 text-muted">
                {permissionMessage || 'Trykk på kartet, eller dra merket til riktig sted.'}
              </Text>
              <Pressable
                onPress={() => void locateAndUse()}
                disabled={isLocating}
                accessibilityRole="button"
                accessibilityLabel="Bruk min posisjon"
                className="flex-row items-center gap-1.5 rounded-full bg-tint px-3.5 py-2"
              >
                {isLocating ? <ActivityIndicator size="small" color={TC.brandText} /> : <Crosshair size={15} color={TC.brandText} />}
                <Text className="text-[0.8125rem] font-semibold text-brand-text">
                  {isLocating ? 'Henter…' : 'Min posisjon'}
                </Text>
              </Pressable>
            </View>
          </Card>

          {/* Fields */}
          <SectionLabel>Adresse</SectionLabel>
          <Card className="overflow-hidden">
            <FormRow
              label="Gateadresse"
              value={draft.address}
              onChangeText={(v) => set('address', v)}
              placeholder="Karl Johans gate 10"
              autoComplete="street-address"
            />
            <FormRow
              divider
              label="Postnummer"
              value={draft.postNumber}
              onChangeText={(v) => set('postNumber', formatPostalCode(v))}
              placeholder="0150"
              maxLength={4}
              keyboardType="number-pad"
              autoComplete="postal-code"
              error={validation || undefined}
            />
            <FormRow
              divider
              label="Sted"
              value={draft.postSted}
              onChangeText={(v) => set('postSted', v)}
              placeholder="Oslo"
            />
          </Card>

          <Text className="mt-4 px-1 text-[0.8125rem] leading-5 text-subtle">
            Alle feltene er valgfrie, og tomme felt lagres som tomme. Landet på profilen endrer du under
            Innstillinger → Lokasjon.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
