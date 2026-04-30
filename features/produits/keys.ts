// Query key factory pour les produits.
// Le portail web n'a pas de catalogue par livreur — il liste tous les produits
// via `GET /produit` et laisse le client choisir le `prixDeVente` (avec
// fallback sur `client.prixDeVenteProduitParDefault` ou
// `produit.prixAchatParDefaut`). On reflète ce comportement côté mobile.
export const produitKeys = {
  all: ['produits'] as const,
  list: () => [...produitKeys.all, 'list'] as const,
};
