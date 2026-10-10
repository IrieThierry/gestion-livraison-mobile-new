import { Stack } from 'expo-router';
import { PendingValidationGate } from '../../../components/shared/PendingValidationGate';

// Pile construite avec la liste du module dessous (deep link / push avec
// withAnchor) : le retour depuis un formulaire ramène à la liste.
export const unstable_settings = { initialRouteName: 'index' };

export default function PrevisionsLayout() {
  return (
    <PendingValidationGate>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingValidationGate>
  );
}
