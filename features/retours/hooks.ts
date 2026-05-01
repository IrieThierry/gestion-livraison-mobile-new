import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LivraisonResponse } from '../../types/api';
import { retoursApi, type CreerRetourClientRequest } from './api';
import { livraisonKeys } from '../livraisons/keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';

/**
 * Mutation qui enregistre un retour client.
 *
 * Côté back, `PUT /livraison` (via `ModifierLivraisonUseCase`)
 * effectue dans une seule transaction :
 *  - mise à jour des `qteRetournee` sur les `ProduitLivraison`
 *  - **PAS** de ré-incrémentation du `stock_courant_livreur` — le
 *    delta de stock est calculé sur `qteLivree` uniquement, et
 *    `qteLivree` reste inchangée lors d'un retour pur. Les unités
 *    retournées sont considérées comme « perdues » côté stock
 *    (consommées, rendues invendables) — métier boulangerie où on
 *    ne ré-empile pas une baguette refusée.
 *  - déduction du montant retourné du solde du client
 *
 * On invalide les 3 sous-arbres : livraisons (statut/qteRetournee
 * impactent l'affichage), encaissements (solde recalculé), et
 * stock (par sécurité, au cas où la mutation contient AUSSI une
 * modification de qteLivree qui aurait, elle, un impact stock).
 */
export function useEnregistrerRetour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      livraison: LivraisonResponse;
      request: CreerRetourClientRequest;
    }) => retoursApi.enregistrer(input.livraison, input.request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
    },
  });
}
