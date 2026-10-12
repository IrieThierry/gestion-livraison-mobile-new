import type { FiltresRemisesArgent, UUID } from '../../types/api';

// Clés des remises d'argent : tout est sous `['remises-argent']`, invalidé
// après chaque écriture (listes, fiche apprenti, cloche).
export const remiseArgentKeys = {
  all: ['remises-argent'] as const,
  miennes: () => ['remises-argent', 'me'] as const,
  parent: (parentId: UUID, filtres: FiltresRemisesArgent = {}) =>
    ['remises-argent', 'parent', parentId, filtres.apprentiId ?? null, filtres.statut ?? null, filtres.debut ?? null, filtres.fin ?? null] as const,
};
