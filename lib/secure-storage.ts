import * as SecureStore from 'expo-secure-store';

export const SecureStorage = {
  async get(key: string): Promise<string | null> {
    return await SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
  /** Efface les jetons. Le choix de la biométrie (par identifiant) est gardé (S4). */
  async clearAuth(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync('access_token'),
      SecureStore.deleteItemAsync('refresh_token'),
    ]);
  },
};
