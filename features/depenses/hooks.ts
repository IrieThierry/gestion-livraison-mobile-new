import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { depensesApi } from './api';
import { etatsKeys } from '../etats/keys';
import type { CreerDepenseRequest, ModifierDepenseRequest, UUID } from '../../types/api';

const depenseKeys = {
  all: ['depenses'] as const,
  list: (start?: string, end?: string) =>
    ['depenses', 'list', start ?? null, end ?? null] as const,
};

export function useDepenses(start?: string, end?: string) {
  return useQuery({
    queryKey: depenseKeys.list(start, end),
    queryFn: () => depensesApi.list({ startDate: start, endDate: end }),
  });
}

export function useCreateDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: CreerDepenseRequest) => depensesApi.create(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depenseKeys.all });
      // État « Dépenses ».
      qc.invalidateQueries({ queryKey: etatsKeys.all });
    },
  });
}

export function useUpdateDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: ModifierDepenseRequest }) =>
      depensesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depenseKeys.all });
      // État « Dépenses ».
      qc.invalidateQueries({ queryKey: etatsKeys.all });
    },
  });
}

export function useDeleteDepense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => depensesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: depenseKeys.all });
      // État « Dépenses ».
      qc.invalidateQueries({ queryKey: etatsKeys.all });
    },
  });
}
