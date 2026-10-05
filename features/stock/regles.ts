import type { ProduitFournisseurResponse, ProduitResponse } from '../../types/api';

/**
 * Produits que le livreur peut acheter chez un fournisseur : lignes actives
 * de son catalogue (`actif !== false`, défense : le back filtre déjà), triées
 * par désignation.
 */
export function produitsAchetables(catalogue: ProduitFournisseurResponse[]): ProduitResponse[] {
  return catalogue
    .filter((l) => l.actif !== false)
    .map((l) => l.produit)
    .sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
}

/**
 * Prix de vente du catalogue par produit (produitId → prix), pour afficher en
 * lecture seule le prix d'une ligne d'achat (produit absent : pas d'entrée).
 */
export function prixCatalogueParProduit(catalogue: ProduitFournisseurResponse[]): Map<string, number> {
  return new Map(catalogue.map((l) => [l.produit.id, Number(l.prixDeVente) || 0]));
}

/**
 * Total indicatif d'un achat : Σ quantité × prix de vente de la ligne du
 * catalogue du fournisseur (produit absent du catalogue : 0).
 */
export function totalIndicatifAchat(
  lignes: { produitId: string; qte: number }[],
  catalogue: ProduitFournisseurResponse[],
): number {
  const prix = prixCatalogueParProduit(catalogue);
  return lignes.reduce((acc, l) => acc + (Number(l.qte) || 0) * (prix.get(l.produitId) ?? 0), 0);
}
