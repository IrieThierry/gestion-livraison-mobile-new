/**
 * Mise en page des boutons du dialog global (components/shared/AppDialog).
 *
 * Deux boutons côte à côte n'ont qu'une demi-largeur de carte (≈ 150 px) :
 * au-delà d'une quinzaine de caractères le libellé est coupé. On empile
 * alors les boutons en pleine largeur, le bouton principal en premier.
 */

/** Longueur maximale d'un libellé qui tient sur un demi-bouton. */
export const LIBELLE_MAX_EN_LIGNE = 14;
/** Longueur cumulée maximale des deux libellés côte à côte. */
export const LIBELLES_CUMULES_MAX_EN_LIGNE = 24;

export type DispositionBoutons = 'ligne' | 'colonne';

export function dispositionBoutons(libelles: readonly string[]): DispositionBoutons {
  if (libelles.length <= 1) return 'ligne';
  if (libelles.length > 2) return 'colonne';
  const longueurs = libelles.map((l) => l.trim().length);
  if (longueurs.some((n) => n > LIBELLE_MAX_EN_LIGNE)) return 'colonne';
  if (longueurs.reduce((a, b) => a + b, 0) > LIBELLES_CUMULES_MAX_EN_LIGNE) return 'colonne';
  return 'ligne';
}

/**
 * Ordre d'affichage (indices dans `styles`) : en ligne, l'ordre fourni
 * (annuler à gauche, valider à droite) ; en colonne, les boutons d'action
 * (primary / destructive) d'abord, les secondaires ensuite.
 */
export function ordreBoutons(
  styles: ReadonlyArray<'primary' | 'secondary' | 'destructive' | undefined>,
  disposition: DispositionBoutons,
): number[] {
  const indices = styles.map((_, i) => i);
  if (disposition === 'ligne') return indices;
  const estSecondaire = (i: number) => styles[i] === 'secondary';
  return [...indices.filter((i) => !estSecondaire(i)), ...indices.filter(estSecondaire)];
}
