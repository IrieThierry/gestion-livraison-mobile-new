import { useQuery } from '@tanstack/react-query';
import { produitsApi } from './api';
import { produitKeys } from './keys';

export function useProduits(enabled = true) {
  return useQuery({
    queryKey: produitKeys.list(),
    queryFn: produitsApi.list,
    enabled,
  });
}
