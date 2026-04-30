import { Stack } from 'expo-router';
import { PendingValidationGate } from '../../../../components/shared/PendingValidationGate';

export default function DepensesLayout() {
  return (
    <PendingValidationGate>
      <Stack screenOptions={{ headerShown: false }} />
    </PendingValidationGate>
  );
}
