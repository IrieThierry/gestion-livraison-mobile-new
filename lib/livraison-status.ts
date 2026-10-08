import type { LivraisonResponse } from '../types/api';
import { formatMontant } from './format';

/**
 * Vrai si la livraison est « Encaissée » au sens du back (E8) : un
 * encaissement la vise ou elle a reçu un paiement, même partiel. Un reste
 * dû est donc possible. Champ absent = non encaissée (aucun repli sur
 * `statut`, toujours `LIVREE`).
 */
export function isEncaissee(l: Pick<LivraisonResponse, 'statutEncaissement'>): boolean {
  return l.statutEncaissement === 'ENCAISSEE';
}

/**
 * Vrai si la livraison est ENTIÈREMENT payée : `entierementPayee` du back,
 * jamais `statutEncaissement` (qui vaut `ENCAISSEE` dès un paiement partiel).
 */
export function isEntierementPayee(
  l: Partial<Pick<LivraisonResponse, 'entierementPayee'>>,
): boolean {
  return l.entierementPayee === true;
}

/**
 * La livraison a encore un reste dû (bouton « Encaisser », filtre
 * « Reste dû », bordure) : `resteDu > 0`, comme le web. Une livraison à dû
 * nul (entièrement retournée) n'a rien à encaisser. Sans `resteDu`, repli
 * sur `!entierementPayee`.
 */
export function isAEncaisser(
  l: Partial<Pick<LivraisonResponse, 'entierementPayee' | 'resteDu'>>,
): boolean {
  if (l.resteDu === undefined || l.resteDu === null) return !isEntierementPayee(l);
  const reste = Number(l.resteDu);
  return Number.isFinite(reste) ? reste > 0 : !isEntierementPayee(l);
}

/**
 * Libellé du badge à deux états suivi du reste dû (serveur) :
 * « Encaissée · reste 500 », « Non encaissée · reste 2 500 ».
 */
export function libelleStatutEncaissement(
  l: Pick<LivraisonResponse, 'statutEncaissement'> &
    Partial<Pick<LivraisonResponse, 'resteDu'>>,
): string {
  const etat = isEncaissee(l) ? 'Encaissée' : 'Non encaissée';
  return `${etat} · reste ${formatMontant(Number(l.resteDu ?? 0) || 0)}`;
}
