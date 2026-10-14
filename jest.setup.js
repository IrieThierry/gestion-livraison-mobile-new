// Stockage natif absent sous Jest : mock officiel d'AsyncStorage (thème, cache…).
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
// Biométrie native absente sous Jest : appareil non compatible par défaut (S4).
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(async () => false),
  isEnrolledAsync: jest.fn(async () => false),
  supportedAuthenticationTypesAsync: jest.fn(async () => []),
  authenticateAsync: jest.fn(async () => ({ success: false })),
  AuthenticationType: { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 },
}));
// Stockage sécurisé natif absent sous Jest : magasin en mémoire.
jest.mock('expo-secure-store', () => {
  const magasin = new Map();
  return {
    getItemAsync: jest.fn(async (k) => (magasin.has(k) ? magasin.get(k) : null)),
    setItemAsync: jest.fn(async (k, v) => {
      magasin.set(k, v);
    }),
    deleteItemAsync: jest.fn(async (k) => {
      magasin.delete(k);
    }),
    /** Vide le magasin (à appeler dans un beforeEach des tests qui l'utilisent). */
    __vider: () => magasin.clear(),
  };
});
