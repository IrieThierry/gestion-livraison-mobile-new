import type { OrigineRetour } from '../../types/api';
import { formatFCFA } from '../../lib/format';

// Mêmes libellés que le web (features/retours/libelles.ts).
const LIBELLES_ORIGINE: Record<OrigineRetour, string> = {
  MENU_RETOURS: 'Menu Retours',
  MODIFICATION_LIVRAISON: 'Modification de la livraison',
  CREATION_LIVRAISON: 'Création de la livraison',
};

export function libelleOrigine(origine: OrigineRetour): string {
  return LIBELLES_ORIGINE[origine] ?? origine;
}

/** Quantité signée du journal : une baisse (négative) est une correction. */
export function libelleQuantite(q: number): string {
  if (q < 0) return `Correction −${Math.abs(q)}`;
  return `+${q}`;
}

export function libelleDestination(remisEnStock: boolean): string {
  return remisEnStock ? 'Remis en stock' : 'Perdu';
}

/** Valeur signée du back telle quelle (300, −100) ; « — » si la ligne a été retirée. */
export function libelleValeur(valeur: number | null | undefined): string {
  if (valeur === null || valeur === undefined) return '—';
  return valeur < 0 ? `−${formatFCFA(Math.abs(valeur))}` : formatFCFA(valeur);
}
