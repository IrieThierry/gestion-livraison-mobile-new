import type { LivraisonResponse } from '../types/api';

/**
 * Vrai si la livraison est ENTIÈREMENT encaissée, d'après `statutEncaissement`
 * calculé par le back (`ENCAISSEE | NON_ENCAISSEE`) — seule source. Champ
 * absent = non encaissée (aucun repli sur `statut`, toujours `LIVREE`).
 */
export function isEncaissee(l: Pick<LivraisonResponse, 'statutEncaissement'>): boolean {
  return l.statutEncaissement === 'ENCAISSEE';
}

/**
 * Inverse de `isEncaissee` : la livraison reste à encaisser (listes « à
 * encaisser », encours, etc.).
 */
export function isAEncaisser(l: Pick<LivraisonResponse, 'statutEncaissement'>): boolean {
  return !isEncaissee(l);
}
