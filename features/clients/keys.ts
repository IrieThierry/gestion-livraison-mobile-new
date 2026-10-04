import type { UUID } from '../../types/api';

// Query key factory pour les clients.
// Aligné sur les conventions du portail web (`['clients', 'by-livreur', id]`).
export const clientKeys = {
  all: ['clients'] as const,
  byLivreur: (livreurId: UUID) => [...clientKeys.all, 'by-livreur', livreurId] as const,
};

// Encours et soldes calculés par le serveur (`/client/encours/...`).
// Famille distincte : à invalider après toute écriture qui change le dû
// d'un client (livraison, retour, encaissement) ou sa limite de crédit.
export const encoursKeys = {
  all: ['encours'] as const,
  byLivreur: (livreurId: UUID) => [...encoursKeys.all, 'by-livreur', livreurId] as const,
  byParent: (parentId: UUID) => [...encoursKeys.all, 'by-parent', parentId] as const,
  client: (clientId: UUID) => [...encoursKeys.all, 'client', clientId] as const,
};
