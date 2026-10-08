// Query key factory pour l'annuaire « Mes fournisseurs » (`GET /livreur/me/fournisseurs`).
export const relationKeys = {
  all: ['relations'] as const,
  fournisseurs: () => [...relationKeys.all, 'fournisseurs'] as const,
};
