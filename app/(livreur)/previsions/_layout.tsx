import { Stack } from 'expo-router';

// Liste du module en bas de pile pour un lien profond ; en navigation, la pile
// est construite par lib/navigation (ouvrir : [liste, formulaire]).
export const unstable_settings = { initialRouteName: 'index' };

export default function PrevisionsLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
