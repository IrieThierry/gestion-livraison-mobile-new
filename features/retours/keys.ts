// Le module retours mobile s'appuie sur l'endpoint `PUT /livraison`
// (le back ne fournit pas de route `/retour-client` dédiée — un retour
// = setter `qteRetournee` sur les ProduitLivraison existants, cf.
// docs/superpowers/plans/2026-04-28-plan-D-marge-stock-retours.md).
// Cette clé est conservée principalement pour symétrie : l'invalidation
// effective passe par les caches `livraisons`, `stock`, `encaissements`
// (la mutation modifie ces trois branches via le ModifierLivraisonUseCase
// côté back).
export const retourKeys = {
  all: ['retours'] as const,
};
