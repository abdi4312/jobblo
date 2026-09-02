const appJson = require('./app.json');

const androidKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '').trim();
const iosKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '').trim();
const apiUrl = String(process.env.EXPO_PUBLIC_API_URL || '').trim();
const easProfile = String(process.env.EAS_BUILD_PROFILE || '').trim();
const localGoogleServicesFile = './google-services.json';

if (easProfile === 'production') {
  const productionApiUrl = apiUrl.replace(/\/$/, '');
  if (!['https://jobblo.no', 'https://jobblo.no/api'].includes(productionApiUrl)) {
    throw new Error(
      'EXPO_PUBLIC_API_URL must be https://jobblo.no for the production build profile'
    );
  }
}

const plugins = (appJson.expo.plugins || []).filter((plugin) => {
  const name = Array.isArray(plugin) ? plugin[0] : plugin;
  return name !== 'react-native-maps';
});

if (androidKey || iosKey) {
  plugins.push([
    'react-native-maps',
    {
      ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}),
      ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}),
    },
  ]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    android: {
      ...appJson.expo.android,
      ...(process.env.GOOGLE_SERVICES_JSON
        ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON }
        : require('fs').existsSync(localGoogleServicesFile)
          ? { googleServicesFile: localGoogleServicesFile }
          : {}),
    },
    plugins,
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        projectId: '8f719d88-1d48-46f4-b74c-344ac749c875',
      },
    },
  },
};
