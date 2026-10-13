import type { Bornes } from '../../lib/periode';

// Query key factory de l'équipe du livreur principal (réaffectation P8).
export const equipeKeys = {
  all: ['equipe'] as const,
  reaffectations: (bornes: Bornes) =>
    [...equipeKeys.all, 'reaffectations', bornes.debut ?? '', bornes.fin ?? ''] as const,
};
