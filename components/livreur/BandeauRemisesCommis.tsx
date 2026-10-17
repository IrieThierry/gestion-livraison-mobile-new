import { Pressable, Text, View } from 'react-native';
import { ChevronRight, PackageCheck } from 'lucide-react-native';
import { useRemisesCommisAConfirmer } from '../../features/commandes/remises';
import { cibleRemisesAConfirmer, libelleRemisesAConfirmer } from '../../features/commandes/remises-regles';
import { ouvrir } from '../../lib/navigation-app';

/**
 * Accueil : remises du commis du fournisseur à confirmer (titulaire ou apprenti
 * affecté). Un appui ouvre la commande s'il n'y en a qu'une, sinon « À
 * réceptionner » (badge « À confirmer »). Rien quand il n'y en a pas.
 */
export function BandeauRemisesCommis({ actif }: { actif: boolean }) {
  const q = useRemisesCommisAConfirmer(actif);
  const remises = actif ? q.data ?? [] : [];
  const cible = cibleRemisesAConfirmer(remises);
  if (!cible) return null;
  return (
    <View className="mt-3">
      <Pressable
        onPress={() => ouvrir(cible)}
        accessibilityRole="button"
        className="flex-row items-center gap-3 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 rounded-lg px-3 py-2.5 active:opacity-70"
      >
        <PackageCheck color="#0284c7" size={18} />
        <View className="flex-1">
          <Text className="font-bold text-[13px] text-sky-900 dark:text-sky-200">
            {libelleRemisesAConfirmer(remises.length)}
          </Text>
          <Text className="text-[11px] text-sky-800 dark:text-sky-300">Produits remis par le commis du fournisseur</Text>
        </View>
        <ChevronRight color="#0284c7" size={16} />
      </Pressable>
    </View>
  );
}
