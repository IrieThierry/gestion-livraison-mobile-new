import { urlPhoto } from '../../lib/api-url';

/**
 * Vignette d'un produit : sa photo si elle existe, sinon l'initiale de sa
 * désignation dans un cercle coloré (G6). Logique pure, testée à part du rendu.
 */

/** Teintes de fond (claires) et de texte (soutenues) des initiales. */
export const TEINTES_VIGNETTE: ReadonlyArray<{ fond: string; texte: string }> = [
  { fond: '#d1fae5', texte: '#047857' },
  { fond: '#dbeafe', texte: '#1d4ed8' },
  { fond: '#fef3c7', texte: '#b45309' },
  { fond: '#ede9fe', texte: '#6d28d9' },
  { fond: '#fce7f3', texte: '#be185d' },
  { fond: '#cffafe', texte: '#0e7490' },
  { fond: '#fee2e2', texte: '#b91c1c' },
  { fond: '#e0e7ff', texte: '#4338ca' },
];

/** Première lettre ou chiffre de la désignation, en majuscule ; « ? » sinon. */
export function initialeProduit(designation: string | null | undefined): string {
  const m = (designation ?? '').match(/[\p{L}\p{N}]/u);
  return m ? m[0].toLocaleUpperCase('fr') : '?';
}

/** Teinte stable pour une désignation (même produit → même couleur). */
export function teinteProduit(designation: string | null | undefined): { fond: string; texte: string } {
  const s = (designation ?? '').trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return TEINTES_VIGNETTE[h % TEINTES_VIGNETTE.length];
}

/** URL affichable de la photo du produit (chemin relatif du back préfixé), ou null. */
export function urlPhotoProduit(photoUrl: string | null | undefined): string | null {
  return urlPhoto(photoUrl);
}
