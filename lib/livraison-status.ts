import type { LivraisonResponse } from '../types/api';

/**
 * Vrai si la livraison est ENTIÈREMENT encaissée.
 *
 * Préfère `statutEncaissement` (calculé à la volée par le back, valeurs
 * `ENCAISSEE | PARTIELLEMENT_ENCAISSEE | NON_ENCAISSEE`) à `statut`
 * métier qui ne transite jamais en pratique. Fallback sur `statut` pour
 * rétro-compatibilité avec les anciens caches qui n'avaient pas le
 * champ.
 *
 * Une livraison `PARTIELLEMENT_ENCAISSEE` n'est PAS considérée comme
 * encaissée — elle reste à compléter.
 */
export function isEncaissee(l: LivraisonResponse): boolean {
  if (l.statutEncaissement) {
    return l.statutEncaissement === 'ENCAISSEE';
  }
  // Fallback : ancien comportement (sessions/caches pré-Plan-D)
  return l.statut === 'ENCAISSEE';
}

/**
 * Inverse de `isEncaissee` — vrai si la livraison reste à encaisser
 * totalement OU partiellement. C'est la prédicat à utiliser pour les
 * listes de « livraisons à encaisser », l'encours, etc.
 */
export function isAEncaisser(l: LivraisonResponse): boolean {
  return !isEncaissee(l);
}
