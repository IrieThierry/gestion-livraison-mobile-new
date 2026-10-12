import { useCallback, useRef } from 'react';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { origineDe, revenirApresEnregistrement } from './navigation-app';

/**
 * Renvoie la fonction à appeler après un enregistrement réussi : ramène à
 * l'écran d'origine valide (`depuis`, ex. la fiche client), sinon à la liste du module (`liste`, ex. '/(livreur)/livraisons') sans laisser le
 * formulaire dans la pile — la pile est dépilée jusqu'à la liste si elle y
 * est, sinon la rubrique repart de [liste] (lib/navigation.ts).
 */
export function useRetourListe(liste: string) {
  const pathname = usePathname();
  const params = useLocalSearchParams();
  // Origine capturée au montage du formulaire.
  const origine = useRef<string | null | undefined>(undefined);
  if (origine.current === undefined) origine.current = origineDe(pathname, params);
  return useCallback(() => revenirApresEnregistrement(liste, origine.current), [liste]);
}
