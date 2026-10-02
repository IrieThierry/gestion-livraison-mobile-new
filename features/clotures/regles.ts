/**
 * Règles pures de la clôture de caisse.
 *
 * Les FCFA sont affichés SANS centimes (`formatFCFA`) : un écart de 0,40 s'affiche « 0 » et doit
 * donc être considéré comme équilibré, de façon cohérente avec l'affichage.
 */
export function estEquilibre(ecart: number): boolean {
  return Math.round(ecart) === 0;
}

/**
 * Parse la saisie du montant remis : accepte la virgule ou le point comme séparateur décimal.
 * Saisie vide ou invalide -> 0 (comportement historique de l'écran).
 */
export function parseMontantRemis(saisie: string): number {
  const s = saisie.trim().replace(',', '.');
  if (s === '') return 0;
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}
