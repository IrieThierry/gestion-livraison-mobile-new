/**
 * Règle de navigation unique de l'app (formulaires et retour arrière).
 *
 *  - Après un enregistrement réussi, on arrive sur la LISTE du module
 *    concerné, sans jamais laisser le formulaire dans la pile.
 *  - Le bouton retour ramène à l'écran précédent de la pile du module, ou à
 *    la liste du module s'il n'y en a pas — jamais au premier onglet par
 *    défaut (le comportement « firstRoute » des onglets).
 *
 * Fonctions pures (sans dépendance à expo-router) pour être testées ; le
 * hook `useRetourListe` les branche sur la pile courante.
 */

/** État minimal d'une pile de navigation (sous-ensemble de React Navigation). */
export interface EtatPile {
  index: number;
  routes: ReadonlyArray<{ name: string }>;
}

/** Sous-ensemble du `router` expo-router utilisé ici. */
export interface RouteurRetour {
  back(): void;
  dismissTo(href: never): void;
  replace(href: never): void;
}

/**
 * Après enregistrement :
 *  - 'back' si l'écran précédent de la pile est la liste du module ;
 *  - 'liste' sinon : on revient à la liste (dépilée si elle est plus bas
 *    dans la pile, sinon elle remplace le formulaire).
 */
export function actionApresEnregistrement(
  etat: EtatPile | undefined,
  ecranListe = 'index',
): 'back' | 'liste' {
  if (!etat || etat.index < 1) return 'liste';
  return etat.routes[etat.index - 1]?.name === ecranListe ? 'back' : 'liste';
}

/** Applique `actionApresEnregistrement` avec le routeur fourni. */
export function retourApresEnregistrement(
  routeur: RouteurRetour,
  liste: string,
  etat: EtatPile | undefined,
  ecranListe = 'index',
): void {
  if (actionApresEnregistrement(etat, ecranListe) === 'back') {
    routeur.back();
  } else {
    // POP_TO : remonte jusqu'à la liste si elle est dans la pile, sinon
    // remplace l'écran courant par la liste (pas de doublon de formulaire).
    routeur.dismissTo(liste as never);
  }
}

/**
 * Bouton retour d'un en-tête :
 *  - 'back' si la pile du module a un écran précédent ;
 *  - 'retourVers' si une liste de module est connue (pile vide) ;
 *  - sinon comportement historique : back() si possible, ou `fallback`.
 */
export function actionRetourEnTete(input: {
  etat: EtatPile | undefined;
  retourVers?: string;
  peutReculer: boolean;
}): 'back' | 'retourVers' | 'fallback' {
  if (input.etat && input.etat.index > 0) return 'back';
  if (input.retourVers) return 'retourVers';
  return input.peutReculer ? 'back' : 'fallback';
}
