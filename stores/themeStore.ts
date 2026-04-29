import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { colorScheme as nwColorScheme } from 'nativewind';

export type Theme = 'light' | 'dark' | 'system';

interface ThemeState {
  theme: Theme;
  effective: 'light' | 'dark';
  setTheme: (t: Theme) => Promise<void>;
  hydrate: () => Promise<void>;
}

function resolveEffective(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return Appearance.getColorScheme() ?? 'light';
  return theme;
}

export const useThemeStore = create<ThemeState>()((set) => ({
  theme: 'system',
  effective: resolveEffective('system'),

  setTheme: async (t) => {
    await AsyncStorage.setItem('theme', t);
    nwColorScheme.set(t);
    set({ theme: t, effective: resolveEffective(t) });
  },

  hydrate: async () => {
    const saved = (await AsyncStorage.getItem('theme')) as Theme | null;
    const t: Theme = saved && ['light', 'dark', 'system'].includes(saved) ? saved : 'system';
    nwColorScheme.set(t);

    // React to OS color-scheme changes when in 'system' mode
    Appearance.addChangeListener(({ colorScheme: scheme }) => {
      const current = useThemeStore.getState();
      if (current.theme === 'system') {
        set({ effective: scheme ?? 'light' });
      }
    });

    set({ theme: t, effective: resolveEffective(t) });
  },
}));
