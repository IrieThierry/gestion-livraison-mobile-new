import type { ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

/**
 * Entrée d'une rubrique de l'espace fournisseur (Argent) : pastille colorée,
 * titre, détail, badge rouge facultatif (actions à traiter).
 */
export function EntreeRubrique({
  Icone,
  couleur,
  titre,
  detail,
  badge,
  onPress,
}: {
  Icone: ComponentType<{ color: string; size: number }>;
  couleur: string;
  titre: string;
  detail: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${titre} : ${badge} à traiter` : titre}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 flex-row items-center gap-3 active:opacity-70"
    >
      <View className="w-9 h-9 rounded-full items-center justify-center" style={{ backgroundColor: couleur }}>
        <Icone color="#ffffff" size={16} />
      </View>
      <View className="flex-1">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{titre}</Text>
        <Text className="text-[11px] text-slate-500 dark:text-slate-400">{detail}</Text>
      </View>
      {badge ? (
        <View className="bg-red-500 rounded-full px-2 py-0.5">
          <Text className="text-white text-[11px] font-bold">{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      <ChevronRight color="#94a3b8" size={16} />
    </Pressable>
  );
}
