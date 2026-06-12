module.exports = {
  moduleFileExtensions: ["js", "json", "ts", "tsx"],
  rootDir: "../..",
  testMatch: ["<rootDir>/apps/web/**/*.test.ts", "<rootDir>/apps/web/**/*.test.tsx", "<rootDir>/packages/ui/**/*.test.tsx"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/apps/web/tsconfig.jest.json",
        isolatedModules: true
      }
    ]
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/apps/web/$1",
    "^@omnichat/ui$": "<rootDir>/packages/ui/src",
    "^@omnichat/ui/(.*)$": "<rootDir>/packages/ui/src/$1",
    "\\.(css|less|scss|sass)$": "<rootDir>/apps/web/test/style-mock.js",
    "^next/font/(.*)$": "<rootDir>/apps/web/test/next-font-mock.js"
  },
  setupFilesAfterEnv: ["<rootDir>/apps/web/jest.setup.ts"],
  testEnvironment: "jsdom"
};
