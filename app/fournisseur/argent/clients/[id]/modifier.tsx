import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../../components/shared/PageHeader';
import { FormulaireClient } from '../../../../../components/fournisseur/FormulaireClient';
import { useClientsFournisseur } from '../../../../../features/fournisseur/clients';

/** Argent → Mes clients → fiche → Modifier : nom, téléphone, actif ou inactif. */
export default function ModifierClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useClientsFournisseur();
  const client = q.data?.find((c) => c.id === id);
  if (!client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Modifier le client" />
        <Text className="text-slate-400 text-sm px-4 pt-2">{q.isLoading ? 'Chargement…' : 'Client introuvable.'}</Text>
      </View>
    );
  }
  return <FormulaireClient key={client.id} client={client} />;
}
