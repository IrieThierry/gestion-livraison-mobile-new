import { Stack } from 'expo-router';

// Pile construite avec la liste du module dessous (deep link / push avec
// withAnchor) : le retour depuis un formulaire ramène à la liste.
export const unstable_settings = { initialRouteName: 'index' };

export default function ApprentisLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
