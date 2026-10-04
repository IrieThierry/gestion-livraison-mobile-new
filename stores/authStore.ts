import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../lib/secure-storage';
import { Biometric } from '../lib/biometric';
import { queryClient, QUERY_CACHE_KEY } from '../lib/query-client';
import type { AuthUser } from '../features/auth/api';

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  /**
   * Persiste l'access token (court, ~15 min) ET le refresh token (long, ~7 j)
   * en SecureStorage, plus l'utilisateur (sans tokens) en AsyncStorage.
   * Appelé par les écrans login + signup.
   */
  setSession: (token: string, refreshToken: string, user: AuthUser) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isHydrated: false,

  // Le back renvoie `token` (access, ~15 min) + `refreshToken` (long, ~7 j).
  // Les deux vivent en SecureStorage (chiffré). L'access est lu par
  // l'intercepteur axios à chaque requête, le refresh est utilisé quand
  // l'access répond 401 pour obtenir un nouveau couple.
  // Le user (sans tokens) est en AsyncStorage pour rendu rapide au démarrage.
  setSession: async (token, refreshToken, user) => {
    await SecureStorage.set('access_token', token);
    await SecureStorage.set('refresh_token', refreshToken);
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  hydrate: async () => {
    const token = await SecureStorage.get('access_token');
    const userRaw = await AsyncStorage.getItem('user');
    if (!token || !userRaw) {
      set({ user: null, isHydrated: true });
      return;
    }

    // Biometric gate (only if previously enabled by user). If the device
    // no longer supports biometric (rare), we fall through and log the
    // user in normally — never lock them out.
    const bioEnabled = await SecureStorage.get('biometric_enabled');
    if (bioEnabled === '1' && (await Biometric.isAvailable())) {
      const ok = await Biometric.authenticate('Déverrouille Gestion Livraison');
      if (!ok) {
        // Don't wipe tokens — user may retry by reopening the app or
        // by entering credentials again on the login screen.
        set({ user: null, isHydrated: true });
        return;
      }
    }

    try {
      set({ user: JSON.parse(userRaw) as AuthUser, isHydrated: true });
    } catch {
      set({ user: null, isHydrated: true });
    }
  },

  logout: async () => {
    await SecureStorage.clearAuth();
    await AsyncStorage.removeItem('user');
    // Cache d'un autre utilisateur : vidé en mémoire ET dans le stockage persisté.
    queryClient.clear();
    await AsyncStorage.removeItem(QUERY_CACHE_KEY);
    set({ user: null });
  },
}));
