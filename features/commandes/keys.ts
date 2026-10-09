// Query key factory des commandes. `all` sert aux invalidations globales
// (création, annulation, règlement par un versement).
export const commandeKeys = {
  all: ['commandes'] as const,
  mes: () => [...commandeKeys.all, 'mes'] as const,
  parFournisseur: (fournisseurId: string) =>
    [...commandeKeys.all, 'par-fournisseur', fournisseurId] as const,
  aRegler: (fournisseurId: string) => [...commandeKeys.all, 'a-regler', fournisseurId] as const,
  catalogue: (fournisseurId: string) => [...commandeKeys.all, 'catalogue', fournisseurId] as const,
  detail: (id: string) => [...commandeKeys.all, 'detail', id] as const,
  aReceptionner: () => [...commandeKeys.all, 'a-receptionner'] as const,
  apprentisAffectables: (fournisseurId: string) =>
    [...commandeKeys.all, 'apprentis-affectables', fournisseurId] as const,
};
