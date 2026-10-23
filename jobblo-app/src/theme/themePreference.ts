import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { colorScheme } from 'nativewind';

/** "Utseende" in Innstillinger: follow the phone, or force light / dark. */
export type ThemePreference = 'system' | 'light' | 'dark';

const KEY = 'jobblo-theme';

function apply(preference: ThemePreference) {
  // NativeWind drives the className colours; Appearance makes native parts (keyboard,
  // alerts, Liquid Glass, status bar) follow the same choice.
  colorScheme.set(preference);
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

export async function loadThemePreference(): Promise<ThemePreference> {
  let preference: ThemePreference = 'system';
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // storage unavailable: follow the phone
  }
  apply(preference);
  return preference;
}

export async function setThemePreference(preference: ThemePreference): Promise<void> {
  apply(preference);
  try {
    await AsyncStorage.setItem(KEY, preference);
  } catch {
    // the choice still applies for this session
  }
}
