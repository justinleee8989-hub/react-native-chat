module.exports = {
  ...require('../jest.config.cjs'),
  rootDir: '..',
  modulePathIgnorePatterns: [],
  testMatch: ['<rootDir>/example/features/im/**/*.ui.test.tsx'],
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^react-native$': '<rootDir>/node_modules/react-native',
    '^@/(.*)$': '<rootDir>/example/$1',
  },
}
