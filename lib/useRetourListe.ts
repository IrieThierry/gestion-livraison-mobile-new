import { useCallback } from 'react';
import { router, useNavigation } from 'expo-router';
import { retourApresEnregistrement, type EtatPile } from './navigation';

/**
 * Renvoie la fonction à appeler après un enregistrement réussi : ramène à
 * la liste du module (`liste`, ex. '/(livreur)/livraisons') sans laisser le
 * formulaire dans la pile. `ecranListe` = nom de la route de la liste dans
 * la pile du formulaire ('index' par défaut).
 */
export function useRetourListe(liste: string, ecranListe = 'index') {
  const navigation = useNavigation();
  return useCallback(() => {
    const etat = navigation.getState() as EtatPile | undefined;
    retourApresEnregistrement(router, liste, etat, ecranListe);
  }, [navigation, liste, ecranListe]);
}
