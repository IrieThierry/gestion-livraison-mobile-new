import { Stack } from 'expo-router';

// Écran de réponse à une demande de position (ouvert par une notification ou le bandeau de l'accueil).
export default function LocalisationLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
