import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { previsionsApi } from './api';
import type {
  CreerPrevisionRequest,
  ModifierPrevisionRequest,
  UUID,
} from '../../types/api';

const previsionKeys = {
  all: ['previsions'] as const,
  byLivreur: (livreurId: UUID, date: string) =>
    ['previsions', 'livreur', livreurId, date] as const,
  cumulLivreur: (livreurId: UUID, date: string) =>
    ['previsions', 'cumul', 'livreur', livreurId, date] as const,
};

export function usePrevisionsLivreur(livreurId: UUID | undefined, date: string) {
  return useQuery({
    queryKey: previsionKeys.byLivreur(livreurId ?? '', date),
    queryFn: () => previsionsApi.byLivreur(livreurId as UUID, date),
    enabled: !!livreurId && !!date,
  });
}

export function useCumulLivreur(livreurId: UUID | undefined, date: string) {
  return useQuery({
    queryKey: previsionKeys.cumulLivreur(livreurId ?? '', date),
    queryFn: () => previsionsApi.cumulByLivreur(livreurId as UUID, date),
    enabled: !!livreurId && !!date,
  });
}

export function useCreerPrevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreerPrevisionRequest) => previsionsApi.create(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: previsionKeys.all });
    },
  });
}

export function useModifierPrevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: ModifierPrevisionRequest }) =>
      previsionsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: previsionKeys.all });
    },
  });
}

export function useSupprimerPrevision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => previsionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: previsionKeys.all });
    },
  });
}
