import { View, Text, Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { retourParent } from '../../lib/navigation-app';

/**
 * Header standard avec titre, sous-titre, bouton back et slot droit.
 *
 * Bouton back : règle unique de navigation (lib/navigation.ts) — retour au
 * PARENT LOGIQUE de l'écran (formulaire ou fiche → sa liste, liste →
 * Accueil), comme le bouton retour Android.
 */
export function PageHeader({
  title,
  subtitle,
  showBack = true,
  right,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <View className="flex-row items-center px-4 pt-3 pb-2 gap-3">
      {showBack ? (
        <Pressable
          onPress={() => retourParent(pathname)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          <ChevronLeft color="#64748b" size={18} />
        </Pressable>
      ) : null}
      <View className="flex-1">
        <Text className="font-extrabold text-slate-900 dark:text-white text-base">{title}</Text>
        {subtitle ? (
          <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
