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
      colors: {
        page: '#EFF0EA',
        surface: '#FFFFFF',
        brand: '#2E6641',
        ink: '#0B0B0B',
        muted: '#63665F',
        line: '#E6E7E1',
        primary: '#2E6641',
        secondary: '#63665F',
        accent: '#F59E0B',
        background: '#EFF0EA',
        border: '#E6E7E1',
        text: '#0B0B0B',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
};
