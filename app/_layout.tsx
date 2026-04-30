import '../global.css';
import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';
import { queryClient, queryPersister } from '../lib/query-client';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';

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
    // The native splash is still visible; render an empty matching-color
    // background so the brief moment between native splash hide and our
    // first real screen doesn't flash white.
    return <View className="flex-1 bg-emerald-500" />;
  }
  return <>{children}</>;
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
