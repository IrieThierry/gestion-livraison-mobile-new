import { useQuery } from '@tanstack/react-query';
import { clientsApi } from './api';
import { clientKeys } from './keys';
import type { UUID } from '../../types/api';

export function useClientsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: clientKeys.byLivreur(livreurId ?? ''),
    queryFn: () => clientsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}
