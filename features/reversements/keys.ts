// Query key factory des reversements (liste + synthèse livreur).
// Exportée pour que les écritures qui changent « remise acquise / en
// attente » (encaissement, retour, livraison) puissent l'invalider.
export const reversementKeys = {
  all: ['reversements'] as const,
  list: (a: number, m: number) => ['reversements', 'list', a, m] as const,
  syntheseLivreur: (mois: string) => ['reversements', 'synthese-livreur', mois] as const,
};
