import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remiseApi } from './api';
import { remiseKeys } from './keys';
import type { UpsertRemiseClientRequest, UUID } from '../../types/api';

export function useRemisesClient(clientId: UUID | undefined) {
  return useQuery({
    queryKey: remiseKeys.parClient(clientId ?? ''),
    queryFn: () => remiseApi.parClient(clientId as UUID),
    enabled: !!clientId,
    staleTime: 60_000,
  });
}

export function useEnregistrerRemise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertRemiseClientRequest) => remiseApi.enregistrer(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: remiseKeys.all });
    },
  });
}

export function useSupprimerRemise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { clientId: UUID; produitId: UUID }) =>
      remiseApi.supprimer(input.clientId, input.produitId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: remiseKeys.all });
    },
  });
}
