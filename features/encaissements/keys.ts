import type { UUID } from '../../types/api';

// Query key factory pour les encaissements de livraison.
// Le portail web n'expose pas de keys dédiées (il appelle inline), on
// centralise ici pour l'invalidation côté mobile.
export const encaissementKeys = {
  all: ['encaissements'] as const,
  byLivreur: (livreurId: UUID) => [...encaissementKeys.all, 'by-livreur', livreurId] as const,
};
