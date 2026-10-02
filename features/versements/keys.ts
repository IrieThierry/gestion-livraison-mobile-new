import type { UUID } from '../../types/api';

// Query key factory pour les versements. La situation dépend de la sélection
// de commandes (identifiants triés pour qu'un ordre de cochage différent ne
// provoque pas de refetch).
export const versementKeys = {
  all: ['versements'] as const,
  situation: (params: { livreurId: UUID; fournisseurId: UUID; commandeIds: UUID[] }) =>
    [
      ...versementKeys.all,
      'situation',
      params.livreurId,
      params.fournisseurId,
      [...params.commandeIds].sort().join(','),
    ] as const,
};
