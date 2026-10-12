import { useCallback } from 'react';
import { revenirA } from './navigation-app';

/**
 * Renvoie la fonction à appeler après un enregistrement réussi : ramène à
 * la liste du module (`liste`, ex. '/(livreur)/livraisons') sans laisser le
 * formulaire dans la pile — la pile est dépilée jusqu'à la liste si elle y
 * est, sinon la rubrique repart de [liste] (lib/navigation.ts).
 */
export function useRetourListe(liste: string) {
  return useCallback(() => revenirA(liste), [liste]);
}
