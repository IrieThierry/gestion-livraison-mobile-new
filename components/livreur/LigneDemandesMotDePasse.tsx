import { Pressable, Text, View } from 'react-native';
import { ChevronRight, KeyRound } from 'lucide-react-native';
import { libelleDemandesMotDePasse } from '../../features/apprentis/regles';

/**
 * M1 : ligne « À traiter » des demandes « Mot de passe oublié » en attente
 * (livreur principal pour ses apprentis, responsable pour ses commerciaux).
 * Ouvre la liste des apprentis, où chaque demande porte le badge
 * « Mot de passe demandé ».
 */
export function LigneDemandesMotDePasse({
  nombre,
  erreur,
  onPress,
}: {
  nombre: number;
  erreur: boolean;
  onPress: () => void;
}) {
  return (
    <View className="gap-3">
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
        Demandes de mot de passe
      </Text>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 flex-row items-center gap-3 active:opacity-70"
      >
        <KeyRound color="#047857" size={20} />
        <Text className="flex-1 font-bold text-slate-900 dark:text-white">
          {erreur ? 'Demandes de mot de passe indisponibles' : libelleDemandesMotDePasse(nombre)}
        </Text>
        <ChevronRight color="#94a3b8" size={18} />
      </Pressable>
    </View>
  );
}
