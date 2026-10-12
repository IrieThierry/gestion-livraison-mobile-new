import { Stack } from 'expo-router';
import { PendingValidationGate } from '../../../components/shared/PendingValidationGate';

// Rubrique sans écran racine (l'ancien carrefour Cash a été supprimé) : la
// pile est construite par lib/navigation (ouvrir : [liste, formulaire]) et le
// retour suit le parent logique de chaque écran.

export default function CashLayout() {
  return (
    <PendingValidationGate>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingValidationGate>
  );
}
