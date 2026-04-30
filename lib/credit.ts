import type { EncaissementLivraisonResponse, LivraisonResponse, UUID } from '../types/api';

/**
 * Mirror exact de gestion-livraison-front/src/lib/credit.ts
 * Garder les deux fonctions synchronisées : la définition de l'encours
 * et du solde fait foi sur le portail web.
 */

/**
 * Encours d'un client = somme `montantLivre` des livraisons encore au
 * statut LIVREE (non encore marquées ENCAISSEE par le back).
 * Représente la 'créance flottante' avant tout encaissement.
 */
export function computeEncoursForClient(
  livraisons: LivraisonResponse[],
  clientId: UUID,
): number {
  return livraisons
    .filter((l) => l.client?.id === clientId && l.statut === 'LIVREE')
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
