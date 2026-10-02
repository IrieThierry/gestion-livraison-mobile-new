import { View, Text } from 'react-native';
import type { StatutCommande } from '../../types/api';

const STYLES: Record<StatutCommande, { bg: string; text: string; label: string }> = {
  ENVOYEE: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    label: 'Envoyée',
  },
  CONFIRMEE: {
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Confirmée',
  },
  REFUSEE: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    label: 'Refusée',
  },
  ANNULEE: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    label: 'Annulée',
  },
  LIVREE: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Livrée',
  },
};

export function CommandeStatusBadge({ statut }: { statut: StatutCommande }) {
  const s = STYLES[statut];
  return (
    <View className={`${s.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${s.text} text-[10px] font-bold`}>{s.label}</Text>
    </View>
  );
}

/** Affiché à côté du statut d'une commande rattachée à un versement. */
export function ReglementBadge() {
  return (
    <View className="bg-violet-100 dark:bg-violet-500/15 px-2 py-0.5 rounded-full self-start">
      <Text className="text-violet-700 dark:text-violet-400 text-[10px] font-bold">Réglée</Text>
    </View>
  );
}
