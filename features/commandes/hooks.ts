import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commandesApi } from './api';
import { commandeKeys } from './keys';
import type { UUID } from '../../types/api';

export function useMesCommandes(enabled = true) {
  return useQuery({
    queryKey: commandeKeys.mes(),
    queryFn: commandesApi.mes,
    enabled,
  });
}

/** Désactivé tant qu'aucun fournisseur n'est choisi. */
export function useCommandesARegler(fournisseurId: UUID | undefined) {
  return useQuery({
    queryKey: commandeKeys.aRegler(fournisseurId ?? ''),
    queryFn: () => commandesApi.aRegler(fournisseurId!),
    enabled: !!fournisseurId,
    staleTime: 0,
  });
}

export function useCatalogueFournisseur(fournisseurId: UUID | undefined) {
  return useQuery({
    queryKey: commandeKeys.catalogue(fournisseurId ?? ''),
    queryFn: () => commandesApi.catalogue(fournisseurId!),
    enabled: !!fournisseurId,
    staleTime: 60_000,
  });
}

export function useCreerCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commandesApi.creer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}

export function useAnnulerCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => commandesApi.annuler(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}
