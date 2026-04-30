import type { UUID } from '../../types/api';

// Mirror exact des clés du web (gestion-livraison-front/src/features/stock/keys.ts)
// pour pouvoir invalider les mêmes branches du cache si on partage des hooks
// par la suite.
export const stockKeys = {
  all: ['stock'] as const,
  actuel: (livreurId: UUID) => [...stockKeys.all, 'actuel', livreurId] as const,
  historique: (livreurId: UUID) => [...stockKeys.all, 'historique', livreurId] as const,
  parentActuel: (parentId: UUID) => [...stockKeys.all, 'parent-actuel', parentId] as const,
  // Le web utilise une clé inline `['stock', 'courant', dateDebut, dateFin]`
  // pour `useStockCourant`. On expose un helper équivalent côté mobile.
  courant: (dateDebut?: string, dateFin?: string) =>
    [...stockKeys.all, 'courant', dateDebut, dateFin] as const,
};
