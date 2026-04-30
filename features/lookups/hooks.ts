import { useQuery } from '@tanstack/react-query';
import { lookupsApi } from './api';

/**
 * Liste plate des fournisseurs (référence). 5 minutes de stale time : la
 * liste change rarement et le back ne gère pas encore le cache HTTP.
 */
export function useFournisseurs() {
  return useQuery({
    queryKey: ['lookups', 'fournisseurs'],
    queryFn: lookupsApi.fournisseurs,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Liste plate des quartiers (référence). Même staleTime que les fournisseurs.
 */
export function useQuartiers() {
  return useQuery({
    queryKey: ['lookups', 'quartiers'],
    queryFn: lookupsApi.quartiers,
    staleTime: 5 * 60 * 1000,
  });
}
