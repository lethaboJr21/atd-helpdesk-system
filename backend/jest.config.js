module.exports = {
  testEnvironment: "node",
  clearMocks: true,
  restoreMocks: true,
  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  }
};