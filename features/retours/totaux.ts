import type { RetourResponse, UUID } from '../../types/api';

/** Une ligne du bloc « Total par produit » des retours affichés. */
export interface TotalRetourProduit {
  produitId: UUID;
  designation: string;
  /** Quantité nette retournée (les corrections, négatives, sont déduites). */
  quantite: number;
  /** Part remise en stock (nette). */
  remisEnStock: number;
  /** Part perdue (nette). */
  perdu: number;
}

/**
 * Total par produit des retours affichés (même période, filtres et recherche
 * que la liste) : une ligne par produit avec la quantité nette retournée et sa
 * répartition remis en stock / perdu. Triée par quantité décroissante puis
 * désignation. Seuls les produits à quantité nette positive ont une ligne : un
 * produit dont tout s'annule (retour puis correction), ou dont seule la
 * correction est chargée (retour sur une autre page), n'en a pas. Même règle
 * que le web (features/retours/totaux.ts).
 */
export function totalRetoursParProduit(retours: readonly RetourResponse[]): TotalRetourProduit[] {
  const parProduit = new Map<UUID, TotalRetourProduit>();
  for (const r of retours) {
    const id = r.produit?.id ?? '';
    let ligne = parProduit.get(id);
    if (!ligne) {
      ligne = { produitId: id, designation: r.produit?.designation ?? '—', quantite: 0, remisEnStock: 0, perdu: 0 };
      parProduit.set(id, ligne);
    }
    const q = Number(r.quantite) || 0;
    ligne.quantite += q;
    if (r.remisEnStock) ligne.remisEnStock += q;
    else ligne.perdu += q;
  }
  return [...parProduit.values()]
    .filter((l) => l.quantite > 0)
    .sort((a, b) => b.quantite - a.quantite || a.designation.localeCompare(b.designation, 'fr'));
}
