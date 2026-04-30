import { Pressable, View, Text } from 'react-native';
import { router } from 'expo-router';
import { StatusBadge } from '../shared/StatusBadge';
import { formatFCFA } from '../../lib/format';
import type { LivraisonResponse } from '../../types/api';

const borderByStatus: Record<string, string> = {
  ENCAISSEE: 'border-l-emerald-500',
  LIVREE: 'border-l-amber-500',
};

export function LivraisonCard({ livraison }: { livraison: LivraisonResponse }) {
  const border = borderByStatus[livraison.statut] ?? 'border-l-slate-300';
  const clientName = `${livraison.client.prenom} ${livraison.client.nom}`;
  const quartier = livraison.client.quartier?.libelle ?? 'Quartier ?';
  const montant = livraison.montantLivre ?? 0;

  return (
    <Pressable
      onPress={() => router.push(`/(livreur)/livraisons/${livraison.id}` as never)}
      className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${border} rounded-lg p-3 active:opacity-70`}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-2">
          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
            {clientName}
          </Text>
          <Text className="text-slate-500 dark:text-slate-400 text-[10px] mt-0.5">
            {quartier} · {formatFCFA(montant)} FCFA
          </Text>
        </View>
        <StatusBadge statut={livraison.statut} />
      </View>
    </Pressable>
  );
}
