import { View, Text } from 'react-native';
import { LIBELLE_STATUT_TRANSFERT } from '../../features/transferts/regles';
import type { StatutTransfert } from '../../types/api';

const STYLES: Record<StatutTransfert, { bg: string; text: string }> = {
  EN_ATTENTE: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-400' },
  ACCEPTE: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  REFUSE: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  ANNULE: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

/** Badge du statut d'un transfert de stock (En attente, Accepté, Refusé, Annulé). */
export function StatutTransfertBadge({ statut }: { statut: StatutTransfert }) {
  const s = STYLES[statut] ?? STYLES.ANNULE;
  return (
    <View className={`${s.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${s.text} text-[10px] font-bold`}>{LIBELLE_STATUT_TRANSFERT[statut] ?? String(statut)}</Text>
    </View>
  );
}
