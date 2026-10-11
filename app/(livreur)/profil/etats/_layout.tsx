import { Stack } from 'expo-router';

// Pile construite avec la liste des états dessous (retour depuis un aperçu).
export const unstable_settings = { initialRouteName: 'index' };

export default function EtatsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
