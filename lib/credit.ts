import type { EncaissementLivraisonResponse, LivraisonResponse, UUID } from '../types/api';
import { isAEncaisser } from './livraison-status';

/**
 * Mirror exact de gestion-livraison-front/src/lib/credit.ts
 * Garder les deux fonctions synchronisées : la définition de l'encours
 * et du solde fait foi sur le portail web.
 */

/**
 * Encours d'un client = somme `montantLivre` des livraisons NON encore
 * encaissées (totalement OU partiellement). On utilise `isAEncaisser`
 * qui s'appuie sur `statutEncaissement` (calculé par le back), avec
 * fallback sur `statut` métier.
 *
 * Important : le filtre direct `statut === 'LIVREE'` incluait à tort
 * toutes les livraisons du client puisque le back ne transite jamais
 * `statut` vers ENCAISSEE — l'encours gonflait avec le temps. Le
 * vrai indicateur d'encaissement est `statutEncaissement` (calculé
 * à la volée).
 */
export function computeEncoursForClient(
  livraisons: LivraisonResponse[],
  clientId: UUID,
): number {
  return livraisons
    .filter((l) => l.client?.id === clientId && isAEncaisser(l))
    .reduce((sum, l) => sum + (Number(l.montantLivre) || 0), 0);
}

/**
 * Détermine si l'encours dépasse la limite crédit du client.
 * limiteCredit === 0 → pas de limite imposée.
 */
export function isEnDepassement(encours: number, limiteCredit: number): boolean {
  return limiteCredit > 0 && encours > limiteCredit;
}

/**
 * Solde signé d'un client :
 *   > 0  → le client nous doit cette somme
 *   < 0  → on doit cette somme au client (trop-perçu)
 *   === 0 → à jour
 *
 * solde = Σ livraisons.montantLivre - Σ encaissements.montantEncaisse
 *
 * `Number()` défensif au cas où Jackson sérialise BigDecimal en string
 * ('1500.00') au lieu de number — sinon `string + number` concatène.
 */
export function computeSoldeForClient(
  livraisons: LivraisonResponse[],
  encaissements: EncaissementLivraisonResponse[],
  clientId: UUID,
): number {
  const totalLivre = livraisons
    .filter((l) => l.client?.id === clientId)
    .reduce((sum, l) => sum + (Number(l.montantLivre) || 0), 0);
  const totalEncaisse = encaissements
    .filter((e) => e.client?.id === clientId)
    .reduce((sum, e) => sum + (Number(e.montantEncaisse) || 0), 0);
  return totalLivre - totalEncaisse;
}
