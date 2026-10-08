import type { ApercuEncaissementRequest, UUID } from '../../types/api';

// Query key factory pour les encaissements de livraison.
export const encaissementKeys = {
  all: ['encaissements'] as const,
  byLivreur: (livreurId: UUID) => [...encaissementKeys.all, 'by-livreur', livreurId] as const,
  aEncaisser: (livreurId: UUID, clientId: UUID) =>
    [...encaissementKeys.all, 'a-encaisser', livreurId, clientId] as const,
  apercu: (p: ApercuEncaissementRequest) => [...encaissementKeys.all, 'apercu', p] as const,
};
