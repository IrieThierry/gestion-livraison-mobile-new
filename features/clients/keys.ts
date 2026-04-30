import type { UUID } from '../../types/api';

// Query key factory pour les clients.
// Aligné sur les conventions du portail web (`['clients', 'by-livreur', id]`).
export const clientKeys = {
  all: ['clients'] as const,
  byLivreur: (livreurId: UUID) => [...clientKeys.all, 'by-livreur', livreurId] as const,
};
