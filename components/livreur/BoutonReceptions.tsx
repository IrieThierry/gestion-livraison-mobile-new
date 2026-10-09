import { Pressable, Text } from 'react-native';
import { router } from 'expo-router';
import type { UUID } from '../../types/api';

/** Bouton « Réceptions » d'une ligne de commande : ouvre la liste détaillée des réceptions. */
export function BoutonReceptions({ commandeId, nombre }: { commandeId: UUID; nombre: number }) {
  if (nombre <= 0) return null;
  return (
    <Pressable
      onPress={() => router.push(`/(livreur)/cash/commandes/receptions?id=${commandeId}` as never)}
      accessibilityLabel="Réceptions"
      className="self-start mt-2 rounded-md px-3 py-1.5 border border-slate-300 dark:border-slate-700 active:opacity-70"
    >
      <Text className="text-slate-800 dark:text-slate-200 font-bold text-[12px]">
        Réceptions ({nombre})
      </Text>
    </Pressable>
  );
}
