import '../global.css';
import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { focusManager, onlineManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, ActivityIndicator, AppState, type AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { queryClient, queryPersister } from '../lib/query-client';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { useNetworkStore } from '../stores/networkStore';

// ---- TanStack Query : focus + online managers branchés sur React Native ----
// Sur le web, react-query écoute `window.focus` et `navigator.onLine`. En
// React Native, ces APIs n'existent pas — il faut câbler manuellement :
//   • `focusManager` ↔ `AppState` (foreground/background)
//   • `onlineManager` ↔ `useNetworkStore` (qui poll déjà expo-network)
// Sans ça les queries ne se rafraîchissent jamais quand l'utilisateur
// ré-ouvre l'app après avoir créé un client sur le web — ce qui était
// précisément le bug remonté.

focusManager.setEventListener((handleFocus) => {
  const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
    if (Platform.OS !== 'web') {
      handleFocus(status === 'active');
    }
  });
  return () => sub.remove();
});

onlineManager.setEventListener((setOnline) => {
  // Le `networkStore` poll déjà expo-network toutes les 5s. On s'abonne
  // à ses mises à jour ; quand `isOnline` passe de false à true,
  // react-query déclenche `refetchOnReconnect` sur toutes les queries.
  setOnline(useNetworkStore.getState().isOnline);
  return useNetworkStore.subscribe((s) => setOnline(s.isOnline));
});

// Native splash control — only meaningful in custom dev clients / production
// builds. Expo Go manages its own splash and rejects these calls with
// "No native splash screen registered". Skip entirely when running in Expo Go
// to avoid noisy uncaught-promise errors in the dev console.
const IS_EXPO_GO = Constants.appOwnership === 'expo';

if (!IS_EXPO_GO) {
  // Keep the native splash visible while we hydrate stores + run biometric.
  // Hidden inside AuthGate once isHydrated flips to true.
  SplashScreen.preventAutoHideAsync().catch(() => {
    /* already hidden or not available — fail silent */
  });
}

function safeHideSplash() {
  if (IS_EXPO_GO) return;
  SplashScreen.hideAsync().catch(() => {
    /* already hidden — fail silent */
  });
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const hydrateTheme = useThemeStore((s) => s.hydrate);
  const segments = useSegments();

  useEffect(() => {
    hydrate();
    hydrateTheme();
  }, []);

  useEffect(() => {
    if (!isHydrated) return;

    // Compute the next route synchronously, then hide splash AFTER navigation
    // so the user never sees a flash of the wrong screen.
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) {
      router.replace('/(auth)/login');
    } else if (user && inAuth) {
      router.replace('/(livreur)');
    }

    // Give the navigation a frame to apply, then hide the splash (no-op in Expo Go).
    const id = setTimeout(safeHideSplash, 50);
    return () => clearTimeout(id);
  }, [isHydrated, user, segments]);

  if (!isHydrated) {
    // Branded splash shown during the JS hydration window. In Expo Go this
    // is the FIRST thing the user sees after Expo Go's own bundle-loader
    // splash hides. In a custom dev / production build, this fills the
    // brief moment between the native splash hide and the first real
    // screen so the transition stays branded instead of flashing white.
    return <BrandedSplash />;
  }
  return <>{children}</>;
}

function BrandedSplash() {
  return (
    <View className="flex-1 bg-emerald-500 items-center justify-center px-8">
      {/* Logo badge — matches the splash-icon.png + login screen */}
      <View
        className="w-24 h-24 rounded-3xl bg-white items-center justify-center mb-6"
        style={{
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Text className="text-emerald-600 font-black text-3xl tracking-tight">
          GL
        </Text>
      </View>

      {/* Wordmark */}
      <Text className="text-white font-extrabold text-2xl tracking-tight">
        Gestion Livraison
      </Text>
      <Text className="text-emerald-50/90 text-[12px] mt-1 tracking-wide uppercase">
        Tournée · Stock · Cash
      </Text>

      {/* Loader */}
      <ActivityIndicator color="#ffffff" className="mt-8" />
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister: queryPersister, maxAge: 24 * 60 * 60 * 1000 }}
      >
        <StatusBar style="auto" />
        <AuthGate>
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f8fafc' } }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(livreur)" />
          </Stack>
        </AuthGate>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
