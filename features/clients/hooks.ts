import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from './api';
import { clientKeys } from './keys';
import type { CreerClientRequest, UUID } from '../../types/api';

export function useClientsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: clientKeys.byLivreur(livreurId ?? ''),
    queryFn: () => clientsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

export function useEnregistrerClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerClientRequest) => clientsApi.enregistrer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
    },
  });
}
