import type { UUID } from '../../types/api';

// Query key factory pour les livraisons.
// Le portail web utilise des tableaux de chaînes inline (`['livraisons']`,
// `['livraisons', 'by-livreur', id]`) — on centralise ici pour éviter les
// drifts de clés entre les composants mobiles.
export const livraisonKeys = {
  all: ['livraisons'] as const,
  list: () => [...livraisonKeys.all, 'list'] as const,
  byLivreur: (livreurId: UUID) => [...livraisonKeys.all, 'by-livreur', livreurId] as const,
  detail: (id: UUID) => [...livraisonKeys.all, 'detail', id] as const,
};
