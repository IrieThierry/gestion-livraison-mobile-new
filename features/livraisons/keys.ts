import type { UUID } from '../../types/api';

// Query key factory pour les livraisons.
// Le portail web utilise des tableaux de chaînes inline (`['livraisons']`,
// `['livraisons', 'by-livreur', id]`) — on centralise ici pour éviter les
// drifts de clés entre les composants mobiles.
export const livraisonKeys = {
  all: ['livraisons'] as const,
  list: () => [...livraisonKeys.all, 'list'] as const,
  byLivreur: (livreurId: UUID) => [...livraisonKeys.all, 'by-livreur', livreurId] as const,
  /** Livraisons du livreur sur une période (`debut` / `fin`, jours inclus) : sous la clé `byLivreur`. */
  byLivreurPeriode: (livreurId: UUID, debut?: string, fin?: string) =>
    [...livraisonKeys.byLivreur(livreurId), 'periode', debut ?? '', fin ?? ''] as const,
  /** Livraisons de l'équipe d'un principal (lui et ses apprentis) sur une période (jours inclus). */
  byParentPeriode: (parentId: UUID, debut: string, fin: string) =>
    [...livraisonKeys.all, 'by-parent', parentId, 'periode', debut, fin] as const,
  detail: (id: UUID) => [...livraisonKeys.all, 'detail', id] as const,
};
