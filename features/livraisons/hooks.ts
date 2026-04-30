import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreerEncaissementLivraisonRequest,
  CreerLivraisonRequest,
  ModifierLivraisonRequest,
  UUID,
} from '../../types/api';
import { livraisonsApi } from './api';
import { livraisonKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys } from '../clients/keys';

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
    },
  });
}

export function useModifierLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModifierLivraisonRequest) => livraisonsApi.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
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
    },
  });
}

/**
 * Encaissement d'une (ou plusieurs) livraisons sur une plage de dates.
 * Le back marque les livraisons concernées comme `ENCAISSEE` — on doit
 * donc forcer un refetch côté mobile pour que les badges, totaux et
 * filtres soient cohérents partout (Tournée, détail livraison, page
 * Clients, etc.).
 *
 * On utilise `refetchType: 'active'` (défaut) qui re-fetch immédiatement
 * toutes les queries actuellement montées : pas d'attente jusqu'au focus
 * suivant.
 */
export function useEncaisserLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerEncaissementLivraisonRequest) => livraisonsApi.encaisser(payload),
    onSuccess: () => {
      // Statut des livraisons → ENCAISSEE pour celles dans la plage
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      // Liste des encaissements (le nouveau apparaît + cumul jour change)
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      // Solde client (la dette baisse)
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
