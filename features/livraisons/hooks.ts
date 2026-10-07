import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreerLivraisonRequest,
  ModifierLivraisonRequest,
  UUID,
} from '../../types/api';
import { livraisonsApi } from './api';
import { livraisonKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { prixKeys } from '../prix/keys';
import { reversementKeys } from '../reversements/keys';

// Le portail web n'expose pas de hooks dédiés (il appelle `useQuery` /
// `useMutation` inline avec `livraisonsApi`). On les expose ici pour
// centraliser la logique d'invalidation côté mobile.

export function useLivraisons() {
  return useQuery({
    queryKey: livraisonKeys.list(),
    queryFn: livraisonsApi.list,
  });
}

export function useLivraisonsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: livraisonKeys.byLivreur(livreurId ?? ''),
    queryFn: () => livraisonsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

/**
 * Création d'une livraison. Côté back, ça déclenche :
 *  - insertion `livraison` + `produit_livraison` (avec marge cristallisée)
 *  - décrément du `stock_courant_livreur` pour chaque ligne
 *
 * On invalide donc à la fois les livraisons ET le stock — sans la 2e
 * invalidation, l'écran "Mon stock" affichait des chiffres périmés
 * jusqu'au prochain refresh manuel.
 */
export function useCreerLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerLivraisonRequest) => livraisonsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      // Le back mémorise dans la même transaction le prix (memoriserPrixClient)
      // et le dû du client change : prix, clients (soldes / encours) et encaissements.
      qc.invalidateQueries({ queryKey: prixKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      // La remise « en attente / acquise » de la synthèse reversements change.
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
  });
}

/** Modification : le dû du client change (encours, encaissements, remises). */
export function useModifierLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModifierLivraisonRequest) => livraisonsApi.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      // La remise « en attente / acquise » de la synthèse reversements change.
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
  });
}

export function useSupprimerLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => livraisonsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      // La remise « en attente / acquise » de la synthèse reversements change.
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
  });
}
