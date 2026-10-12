// Stockage natif absent sous Jest : mock officiel d'AsyncStorage (thème, cache…).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
