/** Clés de cache du dépôt. */
export const depotKeys = {
  all: ['depot'] as const,
  moi: () => [...depotKeys.all, 'moi'] as const,
  visibles: () => [...depotKeys.all, 'visibles'] as const,
};
