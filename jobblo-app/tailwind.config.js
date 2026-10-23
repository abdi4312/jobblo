/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  presets: [require('nativewind/preset')],
  content: [
    './App.{js,jsx,ts,tsx}',
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './screens/**/*.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      // Shared with the website: design-tokens/tokens.json -> node design-tokens/build.mjs
      colors: require('./src/theme/tailwindColors'),
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
