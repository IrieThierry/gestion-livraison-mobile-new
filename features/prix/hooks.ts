import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { prixApi } from './api';
import { prixKeys } from './keys';
import type { UpsertPrixClientRequest, UUID } from '../../types/api';

/**
 * Résout le prix d'un (client, produit) en cascade :
 *   1. prix custom client (table `prix_client_produit`)
 *   2. prix par défaut livreur (table `prix_livreur_produit`)
 *   3. null → aucun prix mémorisé, fallback côté UI
 *
 * `enabled` est false tant qu'on n'a pas les deux IDs — évite un appel
 * inutile pendant que le livreur n'a pas encore choisi le client.
 */
export function useResoudrePrix(clientId: UUID | undefined, produitId: UUID | undefined) {
  return useQuery({
    queryKey: prixKeys.resoudre(clientId ?? '', produitId ?? ''),
    queryFn: () => prixApi.resoudre(clientId!, produitId!),
    enabled: !!clientId && !!produitId,
    staleTime: 30_000,
  });
}

/**
 * Mémorise un prix custom pour ce client/produit. Sur succès, on invalide
 * tout le sous-arbre `prix` pour que les prochains `useResoudrePrix`
 * renvoient le nouveau prix mémorisé.
 */
export function useUpsertPrixClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertPrixClientRequest) => prixApi.upsertPrixClient(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: prixKeys.all });
    },
  });
}
