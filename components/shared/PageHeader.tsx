import { View, Text, Pressable } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { router, useNavigation } from 'expo-router';
import type { ReactNode } from 'react';
import { actionRetourEnTete, type EtatPile } from '../../lib/navigation';

/**
 * Header standard avec titre, sous-titre, bouton back et slot droit.
 *
 * Comportement back (règle unique de navigation, cf. lib/navigation.ts) :
 *  - si la pile du module a un écran précédent → router.back()
 *  - sinon, si `retourVers` (liste du module) est fourni → on y va
 *    (jamais de retombée sur le premier onglet)
 *  - sinon comportement historique : back() si possible, ou `fallback`
 *    (par défaut Tournée) — ça évite que le bouton soit silencieusement
 *    no-op quand on a ouvert l'écran via une Modal sheet ou un replace
 */
export function PageHeader({
  title,
  subtitle,
  showBack = true,
  right,
  fallback = '/(livreur)' as const,
  retourVers,
}: {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  right?: ReactNode;
  fallback?: string;
  /** Liste du module, cible du retour quand la pile n'a pas d'écran précédent. */
  retourVers?: string;
}) {
  const navigation = useNavigation();
  const handleBack = () => {
    const action = actionRetourEnTete({
      etat: navigation.getState() as EtatPile | undefined,
      retourVers,
      peutReculer: router.canGoBack(),
    });
    if (action === 'back') router.back();
    // POP_TO : remonte à la liste si elle est plus bas dans la pile,
    // sinon la liste remplace l'écran courant (pas de doublon).
    else if (action === 'retourVers') router.dismissTo(retourVers as never);
    else router.replace(fallback as never);
  };

  return (
    <View className="flex-row items-center px-4 pt-3 pb-2 gap-3">
      {showBack ? (
        <Pressable
          onPress={handleBack}
          hitSlop={10}
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
