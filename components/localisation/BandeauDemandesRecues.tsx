import { Pressable, Text, View } from 'react-native';
import { ChevronRight, MapPin } from 'lucide-react-native';
import { useDemandesRecues } from '../../features/localisation/hooks';
import { heure } from '../../features/localisation/etat';
import { ouvrir } from '../../lib/navigation-app';

/**
 * Accueil : demandes de position en attente qui me visent (relues toutes les 30 s). Un appui
 * ouvre l'écran de réponse. Rien quand il n'y en a pas.
 */
export function BandeauDemandesRecues() {
  const q = useDemandesRecues();
  const demandes = q.data ?? [];
  if (demandes.length === 0) return null;
  return (
    <View className="mt-3 gap-2">
      {demandes.map((d) => (
        <Pressable
          key={d.id}
          onPress={() => ouvrir(`/(livreur)/localisation/${encodeURIComponent(d.id)}`)}
          accessibilityRole="button"
          className="flex-row items-center gap-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2.5 active:opacity-70"
        >
          <MapPin color="#d97706" size={18} />
          <View className="flex-1">
            <Text className="font-bold text-[13px] text-amber-900 dark:text-amber-200">
              {d.demandeurNom} demande ta position
            </Text>
            <Text className="text-[11px] text-amber-800 dark:text-amber-300">Expire à {heure(d.expireLe)}</Text>
          </View>
          <ChevronRight color="#d97706" size={16} />
        </Pressable>
      ))}
    </View>
  );
}
