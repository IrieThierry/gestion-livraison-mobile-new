import { View, Text } from 'react-native';

const styles: Record<string, { bg: string; text: string; label: string }> = {
  ENCAISSEE: {
    bg: 'bg-emerald-100 dark:bg-emerald-500/15',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Encaissée',
  },
  NON_ENCAISSEE: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    label: 'Non encaissée',
  },
  LIVREE: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    label: 'Livrée',
  },
  EN_COURS: {
    bg: 'bg-blue-100 dark:bg-blue-500/15',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'En cours',
  },
  ENVOYEE: {
    bg: 'bg-amber-100 dark:bg-amber-500/15',
    text: 'text-amber-800 dark:text-amber-400',
    label: 'Envoyée',
  },
  DOIT: {
    bg: 'bg-red-100 dark:bg-red-500/15',
    text: 'text-red-700 dark:text-red-400',
    label: 'Doit',
  },
};

/**
 * Badge de statut. `libelle` remplace le libellé par défaut (ex. badge
 * d'encaissement suivi du reste dû : `libelleStatutEncaissement`).
 */
export function StatusBadge({ statut, libelle }: { statut: string; libelle?: string }) {
  const style = styles[statut] ?? {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    label: statut,
  };
  const label = libelle ?? style.label;
  return (
    <View className={`${style.bg} px-2 py-0.5 rounded-full self-start`}>
      <Text className={`${style.text} text-[10px] font-bold`}>{label}</Text>
    </View>
  );
}
