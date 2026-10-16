/** Clés de cache de la localisation sur demande. */
export const localisationKeys = {
  all: ['localisation'] as const,
  personnes: () => [...localisationKeys.all, 'personnes'] as const,
  recues: () => [...localisationKeys.all, 'recues'] as const,
};
