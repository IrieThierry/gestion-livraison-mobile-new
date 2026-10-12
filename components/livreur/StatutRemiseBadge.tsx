import { View, Text } from 'react-native';
import { LIBELLE_STATUT_REMISE } from '../../features/remises-argent/regles';
import type { StatutRemiseArgent } from '../../types/api';

const STYLES: Record<StatutRemiseArgent, { bg: string; text: string }> = {
  DECLAREE: { bg: 'bg-amber-100 dark:bg-amber-500/15', text: 'text-amber-800 dark:text-amber-400' },
  CONFIRMEE: { bg: 'bg-emerald-100 dark:bg-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
  CONTESTEE: { bg: 'bg-red-100 dark:bg-red-500/15', text: 'text-red-700 dark:text-red-400' },
  ANNULEE: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-300' },
};

/** Badge du statut d'une remise d'argent (Déclarée, Confirmée, Contestée, Annulée). */
export function StatutRemiseBadge({ statut }: { statut: StatutRemiseArgent }) {
  const s = STYLES[statut] ?? STYLES.ANNULEE;
  return (
    <View className={`${s.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${s.text} text-[10px] font-bold`}>{LIBELLE_STATUT_REMISE[statut] ?? String(statut)}</Text>
    </View>
  );
}
