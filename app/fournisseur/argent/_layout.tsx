import { Stack } from 'expo-router';

// Racine de l'onglet en bas de pile pour un lien profond (notification…).
export const unstable_settings = { initialRouteName: 'index' };

export default function ArgentFournisseurLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
