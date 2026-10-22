import { Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Which map SDK every MapView uses.
 *
 * Android always uses Google Maps. On iOS, Google Maps needs the Google SDK and an iOS key
 * compiled into the build — app.config.js adds them only when EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
 * is set — and Expo Go on iOS never has them. A Google MapView without them renders an empty
 * box, so iOS falls back to Apple Maps (free, no key) in exactly those cases.
 */
const iosHasGoogleMaps =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient &&
  Constants.expoConfig?.extra?.iosGoogleMaps === true;

export const MAP_PROVIDER = Platform.OS === 'ios' && !iosHasGoogleMaps ? undefined : PROVIDER_GOOGLE;

/**
 * False on an Android build made without EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY: there a
 * MapView throws "API key not found" natively and takes the whole app down, so screens
 * render <MapUnavailable /> instead. Expo Go ships its own key.
 */
export const MAPS_AVAILABLE =
  Platform.OS !== 'android' ||
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.expoConfig?.extra?.androidGoogleMaps === true;
