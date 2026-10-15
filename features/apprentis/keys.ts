import type { UUID } from '../../types/api';

// Mirror exact des clés web (gestion-livraison-front/src/features/apprentis/keys.ts).
export const apprentiKeys = {
  all: ['apprentis'] as const,
  list: (parentId: UUID) => [...apprentiKeys.all, 'list', parentId] as const,
};

/** M1 : demandes « Mot de passe oublié » en attente (GET /auth/demandes-reinitialisation). */
export const demandesReinitialisationKeys = {
  all: ['demandes-reinitialisation'] as const,
};
