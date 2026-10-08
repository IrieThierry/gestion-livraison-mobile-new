import type { FiltresRetours } from '../../types/api';

// Query key factory pour le journal des retours (`GET /retour`).
export const retourKeys = {
  all: ['retours'] as const,
  liste: (filtres: FiltresRetours) => [...retourKeys.all, 'liste', filtres] as const,
};
