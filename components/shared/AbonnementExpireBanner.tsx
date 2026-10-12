import { View, Text } from 'react-native';
import { Lock } from 'lucide-react-native';
import { useMonAbonnement } from '../../features/abonnement/hooks';
import { estExpire, MESSAGE_ABONNEMENT_EXPIRE } from '../../features/abonnement/regles';

/**
 * Bandeau de l'Accueil quand l'abonnement effectif est EXPIRE : l'app reste
 * consultable, les écritures sont refusées par le back (403, message montré
 * tel quel par `extractApiErrorMessage`). Rien en ESSAI ni en ACTIF.
 */
export function AbonnementExpireBanner() {
  const { data } = useMonAbonnement();
  if (!estExpire(data)) return null;
  return (
    <View
      accessibilityRole="alert"
      className="flex-row items-center gap-2 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md px-3 py-2.5 mt-3"
    >
      <Lock color="#dc2626" size={16} />
      <Text className="flex-1 text-[13px] font-bold text-red-700 dark:text-red-400">
        {MESSAGE_ABONNEMENT_EXPIRE}
      </Text>
    </View>
  );
}
