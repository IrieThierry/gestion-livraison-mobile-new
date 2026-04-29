import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureStorage } from '../lib/secure-storage';
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
    if (token && userRaw) {
      try {
        set({ user: JSON.parse(userRaw) as AuthUser, isHydrated: true });
      } catch {
        set({ user: null, isHydrated: true });
      }
    } else {
      set({ user: null, isHydrated: true });
    }
  },

  logout: async () => {
    await SecureStorage.clearAuth();
    await AsyncStorage.removeItem('user');
    set({ user: null });
  },
}));
