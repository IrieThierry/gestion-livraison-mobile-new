import type { RemiseCommisResponse } from '../../types/api';

/**
 * Règles pures des remises du commis, côté livreur (titulaire ou apprenti
 * affecté) : confirmer ou refuser avec un motif, bandeau d'accueil.
 */

export const MOTIF_OBLIGATOIRE = 'Le motif est obligatoire.';

export type MotifLu = { ok: true; motif: string } | { ok: false; erreur: string };

/** Motif du refus : obligatoire, sans espaces autour (même message que le back). */
export function lireMotifRefus(saisie: string): MotifLu {
  const motif = saisie.trim();
  return motif ? { ok: true, motif } : { ok: false, erreur: MOTIF_OBLIGATOIRE };
}

/** Remises qui attendent encore la réponse du livreur. */
export const remisesEnAttente = (remises: readonly RemiseCommisResponse[] | undefined): RemiseCommisResponse[] =>
  (remises ?? []).filter((r) => r.statut === 'EN_ATTENTE');

/** Texte du bandeau d'accueil : « 1 remise à confirmer », « 3 remises à confirmer ». */
export const libelleRemisesAConfirmer = (n: number): string =>
  `${n} remise${n > 1 ? 's' : ''} à confirmer`;

/**
 * Écran ouvert par le bandeau : la commande quand toutes les remises en attente
 * la concernent, sinon « À réceptionner » (badge « À confirmer ») ; null sans remise.
 */
export function cibleRemisesAConfirmer(remises: readonly RemiseCommisResponse[]): string | null {
  if (remises.length === 0) return null;
  const commandes = new Set(remises.map((r) => r.commandeId));
  return commandes.size === 1
    ? `/(livreur)/cash/commandes/${encodeURIComponent(remises[0].commandeId)}`
    : '/(livreur)/cash/commandes/a-receptionner';
}
