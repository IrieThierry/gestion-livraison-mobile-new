import { Stack } from 'expo-router';
import { PendingValidationGate } from '../../../components/shared/PendingValidationGate';

export default function LivraisonsLayout() {
  return (
    <PendingValidationGate>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingValidationGate>
  );
}
