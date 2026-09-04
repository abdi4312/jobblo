module.exports = {
  testEnvironment: 'node',
  transform: {},
  transformIgnorePatterns: [],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
};
