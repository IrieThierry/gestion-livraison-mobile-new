import type { UUID } from '../../types/api';

// Query key factory pour les versements. On centralise ici les
// invalidations côté mobile — le portail web n'expose pas de keys
// dédiées (il appelle inline les `queryKey: ['versement', ...]`).
export const versementKeys = {
  all: ['versements'] as const,
  situation: (params: {
    livreurId: UUID;
    fournisseurId: UUID;
    dateDebut: string;
    dateFin: string;
  }) => [...versementKeys.all, 'situation', params] as const,
};
