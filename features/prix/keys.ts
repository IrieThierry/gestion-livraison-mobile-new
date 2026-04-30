import type { UUID } from '../../types/api';

// Mirror exact des clés web (gestion-livraison-front/src/features/prix/keys.ts).
export const prixKeys = {
  all: ['prix'] as const,
  resoudre: (clientId: UUID, produitId: UUID) =>
    [...prixKeys.all, 'resoudre', clientId, produitId] as const,
};
