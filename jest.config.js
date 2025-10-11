/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  moduleDirectories: ["node_modules", "<rootDir>"],
  roots: ["<rootDir>/tests/unit"],
  clearMocks: true,
  coveragePathIgnorePatterns: ["/node_modules/", "/tests/"],
};

module.exports = config;
