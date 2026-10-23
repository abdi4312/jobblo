const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// rem = 16 px like the website (NativeWind defaults to 14, which made all app text 12.5 %
// smaller than the web: text-[0.75rem] rendered at 10.5 px).
module.exports = withNativeWind(config, { input: './app/global.css', inlineRem: 16 });
