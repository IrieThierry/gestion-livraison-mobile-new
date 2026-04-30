import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CreerEncaissementLivraisonRequest,
  CreerLivraisonRequest,
  ModifierLivraisonRequest,
  UUID,
} from '../../types/api';
import { livraisonsApi } from './api';
import { livraisonKeys } from './keys';

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

export function useCreerLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerLivraisonRequest) => livraisonsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
    },
  });
}

export function useModifierLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModifierLivraisonRequest) => livraisonsApi.update(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
    },
  });
}

export function useSupprimerLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => livraisonsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
    },
  });
}

export function useEncaisserLivraison() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerEncaissementLivraisonRequest) => livraisonsApi.encaisser(payload),
    onSuccess: () => {
      // Une nouvelle encaisse change le statut des livraisons concernées.
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: ['encaissements'] });
    },
  });
}
