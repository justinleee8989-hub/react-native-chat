const base = require('./jest.config.cjs')

module.exports = {
  ...base,
  rootDir: __dirname,
  modulePathIgnorePatterns: [],
  testMatch: ['<rootDir>/example/features/im/**/*.ui.test.ts?(x)'],
  moduleNameMapper: {
    '^react$': '<rootDir>/node_modules/react',
    '^@/(.*)$': '<rootDir>/example/$1',
  },
}
