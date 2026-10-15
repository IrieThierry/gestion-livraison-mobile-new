import { ActivityIndicator, Text, View } from 'react-native';
import { useRecuStore } from '../../stores/recuStore';

export const LIBELLE_PREPARATION_RECU = 'Préparation du reçu…';

/**
 * Bandeau affiché pendant la préparation d'un reçu de reversement (lecture du
 * détail de la période, puis PDF), quel que soit l'écran : le partage peut
 * partir d'un dialogue après le retour à la liste.
 */
export function PreparationRecuBanner() {
  const preparation = useRecuStore((s) => s.preparation);
  if (!preparation) return null;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={LIBELLE_PREPARATION_RECU}
      className="bg-emerald-800 px-4 py-2 flex-row items-center justify-center gap-2"
    >
      <ActivityIndicator color="#fff" size="small" />
      <Text className="text-white text-xs font-bold">{LIBELLE_PREPARATION_RECU}</Text>
    </View>
  );
}
