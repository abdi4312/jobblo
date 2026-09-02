const appJson = require('./app.json');

const androidKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY || '').trim();
const iosKey = String(process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY || '').trim();

const plugins = [...(appJson.expo.plugins || [])];

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
    plugins,
    extra: {
      ...(appJson.expo.extra || {}),
      eas: {
        projectId: '8f719d88-1d48-46f4-b74c-344ac749c875',
      },
    },
  },
};
