module.exports = {
  testEnvironment: 'node',
  transform: {},
  transformIgnorePatterns: [],
  moduleNameMapper: {
    '^expo-server-sdk$': '<rootDir>/test-utils/expo-server-sdk.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
