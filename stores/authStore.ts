import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../lib/secure-storage';
import { Biometric } from '../lib/biometric';
import type { AuthUser } from '../features/auth/api';

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  setSession: (token: string, user: AuthUser) => Promise<void>;
  hydrate: () => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  isHydrated: false,

  // Le back ne renvoie qu'un seul token (pas de refresh). On le persiste
  // sous la clé `access_token` que l'intercepteur axios lit déjà.
  setSession: async (token, user) => {
    await SecureStorage.set('access_token', token);
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
    set({ user: null });
  },
}));
