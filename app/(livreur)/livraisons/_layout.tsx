import { Stack } from 'expo-router';
import { PendingValidationGate } from '../../../components/shared/PendingValidationGate';

// Liste du module en bas de pile pour un lien profond ; en navigation, la pile
// est construite par lib/navigation (ouvrir : [liste, formulaire]).
export const unstable_settings = { initialRouteName: 'index' };

export default function LivraisonsLayout() {
  return (
    <PendingValidationGate>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingValidationGate>
  );
}
