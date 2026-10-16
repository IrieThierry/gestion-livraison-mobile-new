import { Pressable, Text, View } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { libelleMois, moisVoisin, peutAvancer } from '../../features/fournisseur/regles';

/** Mois `yyyy-MM` choisi avec ‹ et › ; jamais un mois à venir. */
export function SelecteurMois({
  mois,
  onChange,
  desactive = false,
}: {
  mois: string;
  onChange: (mois: string) => void;
  /** Sélecteur inactif (ex. « Toutes périodes »). */
  desactive?: boolean;
}) {
  const avancer = !desactive && peutAvancer(mois);
  return (
    <View className={`flex-row items-center justify-between ${desactive ? 'opacity-40' : ''}`}>
      <Pressable
        onPress={() => onChange(moisVoisin(mois, -1))}
        disabled={desactive}
        accessibilityRole="button"
        accessibilityLabel="Mois précédent"
        accessibilityState={{ disabled: desactive }}
        hitSlop={8}
        className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
      >
        <ChevronLeft color="#64748b" size={18} />
      </Pressable>
      <Text className="font-extrabold text-slate-900 dark:text-white capitalize">{libelleMois(mois)}</Text>
      <Pressable
        onPress={() => onChange(moisVoisin(mois, 1))}
        disabled={!avancer}
        accessibilityRole="button"
        accessibilityLabel="Mois suivant"
        accessibilityState={{ disabled: !avancer }}
        hitSlop={8}
        className={`w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center ${
          avancer ? 'active:opacity-70' : 'opacity-40'
        }`}
      >
        <ChevronRight color="#64748b" size={18} />
      </Pressable>
    </View>
  );
}
