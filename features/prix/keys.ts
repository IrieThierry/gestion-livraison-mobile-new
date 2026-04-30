import type { UUID } from '../../types/api';

// Mirror exact des clés web (gestion-livraison-front/src/features/prix/keys.ts).
export const prixKeys = {
  all: ['prix'] as const,
  mesPrix: () => [...prixKeys.all, 'me'] as const,
  prixClient: (clientId: UUID) => [...prixKeys.all, 'client', clientId] as const,
  resoudre: (clientId: UUID, produitId: UUID) =>
    [...prixKeys.all, 'resoudre', clientId, produitId] as const,
};
