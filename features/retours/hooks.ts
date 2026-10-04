import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LivraisonResponse } from '../../types/api';
import { retoursApi, type CreerRetourClientRequest } from './api';
import { livraisonKeys } from '../livraisons/keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys } from '../clients/keys';

/**
 * Mutation qui enregistre un retour client (`PUT /livraison`).
 *
 * Côté back (`ModifierLivraisonUseCase`, une transaction) :
 *  - `qteRetournee` et `qteRetourneeEnStock` des lignes sont mis à jour ;
 *  - le stock courant du livreur est ré-incrémenté de la part « remise en
 *    stock » uniquement (la part « perdue » ne revient pas en stock) ;
 *  - le dû du client baisse de (prix + remise) × quantité retournée.
 *
 * On invalide livraisons, stock, encaissements et clients (soldes).
 */
export function useEnregistrerRetour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { livraison: LivraisonResponse; request: CreerRetourClientRequest }) =>
      retoursApi.enregistrer(input.livraison, input.request),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
