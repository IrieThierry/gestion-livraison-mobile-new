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
 * Total indicatif d'un achat : Σ quantité × prix de vente de la ligne du
 * catalogue du fournisseur (produit absent du catalogue : 0).
 */
export function totalIndicatifAchat(
  lignes: { produitId: string; qte: number }[],
  catalogue: ProduitFournisseurResponse[],
): number {
  const prix = new Map(catalogue.map((l) => [l.produit.id, Number(l.prixDeVente) || 0]));
  return lignes.reduce((acc, l) => acc + (Number(l.qte) || 0) * (prix.get(l.produitId) ?? 0), 0);
}
