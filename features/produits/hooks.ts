import { useQuery } from '@tanstack/react-query';
import { produitsApi } from './api';
import { produitKeys } from './keys';

export function useProduits() {
  return useQuery({
    queryKey: produitKeys.list(),
    queryFn: produitsApi.list,
  });
}
