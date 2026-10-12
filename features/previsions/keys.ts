import type { UUID } from '../../types/api';

// Clés des prévisions : tout est sous `['previsions']`, invalidé après chaque
// écriture (liste, cumul, échues et compteur de la cloche, mémoire « Plus tard »).
export const previsionKeys = {
  all: ['previsions'] as const,
  byLivreur: (livreurId: UUID, date: string) => ['previsions', 'livreur', livreurId, date] as const,
  byParent: (parentId: UUID, date: string) => ['previsions', 'parent', parentId, date] as const,
  cumulLivreur: (livreurId: UUID, date: string) =>
    ['previsions', 'cumul', 'livreur', livreurId, date] as const,
  cumulParent: (parentId: UUID, date: string) => ['previsions', 'cumul', 'parent', parentId, date] as const,
  plusTard: (userId: UUID) => ['previsions', 'plus-tard', userId] as const,
};
