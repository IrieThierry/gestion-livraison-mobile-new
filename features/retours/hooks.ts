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
 *  - ré-incrémentation du `stock_courant_livreur`
 *  - déduction du solde client
 *
 * On invalide donc les trois branches du cache.
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
