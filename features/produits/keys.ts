// Query key factory pour les produits.
// Le portail web n'a pas de catalogue par livreur — il liste tous les produits
// via `GET /produit` et laisse le client choisir le `prixDeVente` (avec
// repli sur `client.prixDeVenteProduitParDefault`, sinon prix à saisir ;
// plus de prix d'achat par défaut sur le produit). Même comportement côté mobile.
export const produitKeys = {
  all: ['produits'] as const,
  list: () => [...produitKeys.all, 'list'] as const,
};
