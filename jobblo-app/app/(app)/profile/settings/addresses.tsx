import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Crosshair, Loader2, MapPinHouse, Navigation2 } from 'lucide-react-native';
import MapView, {
  LatLng,
  MapPressEvent,
  Marker,
  MarkerDragStartEndEvent,
  PROVIDER_GOOGLE,
  Region,
} from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useProfile, useUpdateProfile } from '../../../../src/hooks/useProfile';
import { useAuthStore } from '../../../../src/store/authStore';
import { ErrorState } from '../../../../src/components/ui/ErrorState';
import { LoadingIndicator } from '../../../../src/components/ui/LoadingIndicator';
import type { CurrentProfile } from '../../../../src/services/profile.service';

const FIELD_BASE =
  'rounded-2xl border border-[#E6E7E1] bg-white px-4 pt-6 pb-3 text-[0.9375rem] text-[#0B0B0B] placeholder:text-[#9B9E96]';

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
  const [initialCentered, setInitialCentered] = useState(false);

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
              setInitialCentered(true);
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
      setInitialCentered(true);
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
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
        <LoadingIndicator message="Laster adresser..." />
      </SafeAreaView>
    );
  }
  if (isError || !profile) {
    return (
      <SafeAreaView className="flex-1 bg-[#EFF0EA]">
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
    <SafeAreaView className="flex-1 bg-[#EFF0EA]">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center border-b border-[#E6E7E1] bg-white px-4 py-3">
          <Pressable
            onPress={leave}
            accessibilityLabel="Tilbake"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <ArrowLeft size={22} color="#0B0B0B" />
          </Pressable>
          <Text className="ml-2 text-lg font-semibold text-[#0B0B0B]">Adresser</Text>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          contentContainerStyle={{ padding: 16, paddingBottom: 36 }}
        >
          <View className="mb-4 flex-row items-start gap-3 rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF1E9]">
              <MapPinHouse size={18} color="#2E6641" />
            </View>
            <View className="min-w-0 flex-1">
              <Text className="text-sm font-bold text-[#0B0B0B]">Kontaktadresse</Text>
              <Text className="mt-1 text-xs leading-5 text-[#63665F]">
                Gateadresse, postnummer og sted lagres på Jobblo-kontoen din.
              </Text>
            </View>
          </View>

          <View className="rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <Text className="mb-4 text-base font-semibold text-[#0B0B0B]">Adresse</Text>

            <View>
              <Text className="pointer-events-none absolute left-4 top-3 z-10 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">
                Gateadresse
              </Text>
              <TextInput
                value={draft.address}
                onChangeText={(v) => set('address', v)}
                placeholder="Karl Johans gate 10"
                placeholderTextColor="#9B9E96"
                autoComplete="street-address"
                className={FIELD_BASE}
              />
            </View>

            <View className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <View>
                <Text className="pointer-events-none absolute left-4 top-3 z-10 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">
                  Postnummer
                </Text>
                <TextInput
                  value={draft.postNumber}
                  onChangeText={(v) => set('postNumber', formatPostalCode(v))}
                  placeholder="0150"
                  placeholderTextColor="#9B9E96"
                  maxLength={4}
                  autoComplete="postal-code"
                  keyboardType="number-pad"
                  className={FIELD_BASE}
                />
                <Text className="mt-1 text-[0.6875rem] text-right text-[#9B9E96]">
                  {draft.postNumber.length}/4
                </Text>
              </View>

              <View>
                <Text className="pointer-events-none absolute left-4 top-3 z-10 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-[#9B9E96]">
                  Sted
                </Text>
                <TextInput
                  value={draft.postSted}
                  onChangeText={(v) => set('postSted', v)}
                  placeholder="Oslo"
                  placeholderTextColor="#9B9E96"
                  autoComplete="address-line2"
                  className={FIELD_BASE}
                />
              </View>
            </View>

            {validation ? <Text className="mt-3 text-xs text-[#B4544A]">{validation}</Text> : null}
          </View>

          <View className="mt-6 rounded-3xl border border-[#E6E7E1] bg-white p-5">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-[#0B0B0B]">Velg adresse på kartet</Text>
              {isGeocoding ? (
                <View className="flex-row items-center gap-1.5">
                  <Loader2 size={14} color="#63665F" />
                  <Text className="text-[0.75rem] text-[#63665F]">Finner adresse…</Text>
                </View>
              ) : null}
            </View>

            <View
              style={{ height: 288 }}
              className="relative w-full overflow-hidden rounded-2xl bg-[#F4F6F0]"
            >
              <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ ...StyleSheet.absoluteFill, flex: 1, width: '100%', height: '100%' }}
                mapType="standard"
                region={
                  selectedCoordinate
                    ? { ...selectedCoordinate, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                    : currentDeviceLocation
                      ? { ...currentDeviceLocation, latitudeDelta: 0.02, longitudeDelta: 0.02 }
                      : DEFAULT_REGION
                }
                initialRegion={DEFAULT_REGION}
                showsUserLocation={permission.status === 'granted'}
                showsMyLocationButton={false}
                showsCompass
                showsBuildings
                showsTraffic={false}
                zoomEnabled
                scrollEnabled
                rotateEnabled={false}
                pitchEnabled={false}
                moveOnMarkerPress={false}
                onPress={handleMapPress}
              >
                {selectedCoordinate ? (
                  <Marker
                    coordinate={selectedCoordinate}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    tracksViewChanges={false}
                  >
                    <View className="items-center justify-center">
                      <View className="h-10 w-10 items-center justify-center rounded-full bg-[#2E6641] shadow-lg shadow-black/20">
                        <Navigation2 size={18} color="#FFFFFF" fill="#FFFFFF" />
                      </View>
                      <View className="h-2 w-2 rounded-full bg-[#2E6641]" />
                    </View>
                  </Marker>
                ) : null}
              </MapView>

              <Pressable
                onPress={() => void locateAndUse()}
                disabled={isLocating}
                accessibilityLabel="Bruk min posisjon"
                className="absolute bottom-3 right-3 h-11 w-11 items-center justify-center rounded-full bg-white shadow-md shadow-black/20"
              >
                {isLocating ? (
                  <Loader2 size={18} color="#2E6641" />
                ) : (
                  <Crosshair size={18} color="#2E6641" />
                )}
              </Pressable>
            </View>

            <View className="mt-3 flex-row flex-wrap items-center gap-3">
              <Pressable
                onPress={() => void locateAndUse()}
                disabled={isLocating}
                className="flex-row items-center gap-2 rounded-full bg-[#EAF1E9] px-4 py-2"
              >
                {isLocating ? (
                  <Loader2 size={14} color="#2E6641" />
                ) : (
                  <Crosshair size={14} color="#2E6641" />
                )}
                <Text className="text-[0.8125rem] font-semibold text-[#2E6641]">
                  {isLocating ? 'Henter posisjon…' : 'Bruk min posisjon'}
                </Text>
              </Pressable>
            </View>

            {permissionMessage ? (
              <Text className="mt-3 text-[0.75rem] leading-5 text-[#63665F]">
                {permissionMessage}
              </Text>
            ) : (
              <Text className="mt-3 text-[0.75rem] leading-5 text-[#63665F]">
                Trykk på kartet for å velge adresse. Du kan også dra det grønne merket til rett
                plassering.
              </Text>
            )}
          </View>

          <View className="mt-4 rounded-2xl bg-[#FBFCF8] px-4 py-3">
            <Text className="text-[0.75rem] leading-5 text-[#63665F]">
              Feltene er valgfritt. Du kan tømme dem når som helst — tomme verdier lagres direkte.
              Land / profilplassering endres fra den egne Innstillinger → Lokasjon-skjermen.
            </Text>
          </View>
        </ScrollView>

        <View className="border-t border-[#E6E7E1] bg-white px-4 py-3">
          <Pressable
            onPress={save}
            disabled={!canSave}
            className={[
              'flex-row items-center justify-center rounded-full py-3.5',
              canSave ? 'bg-[#2E6641]' : 'bg-[#F4F6F0] border border-[#E6E7E1]',
            ].join(' ')}
          >
            {update.isPending ? (
              <Loader2 size={16} color={canSave ? '#FFFFFF' : '#9B9E96'} />
            ) : null}
            <Text
              className={[
                'ml-2 text-sm font-semibold',
                canSave ? 'text-white' : 'text-[#9B9E96]',
              ].join(' ')}
            >
              {update.isPending ? 'Lagrer...' : 'Lagre adresser'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
