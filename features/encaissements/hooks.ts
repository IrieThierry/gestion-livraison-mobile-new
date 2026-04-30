import { useQuery } from '@tanstack/react-query';
import type { UUID } from '../../types/api';
import { encaissementsApi } from './api';
import { encaissementKeys } from './keys';

export function useEncaissementsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: encaissementKeys.byLivreur(livreurId ?? ''),
    queryFn: () => encaissementsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}
