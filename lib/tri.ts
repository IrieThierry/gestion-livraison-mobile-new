/**
 * P3 : tri alphabétique des produits par désignation, en français, sans tenir
 * compte des accents ni des majuscules (`localeCompare` sensibilité « base »).
 * Une désignation absente passe en dernier ; le tri est stable (ordre
 * d'origine conservé entre deux désignations équivalentes).
 */
export function comparerDesignations(a: string | null | undefined, b: string | null | undefined): number {
  const va = a ?? '';
  const vb = b ?? '';
  if (!va || !vb) return (va ? 0 : 1) - (vb ? 0 : 1);
  return va.localeCompare(vb, 'fr', { sensitivity: 'base' });
}

/** Copie triée par désignation (`designation` lue par `cle`), stable. */
export function trierParDesignation<T>(
  items: readonly T[] | null | undefined,
  cle: (item: T) => string | null | undefined,
): T[] {
  return (items ?? [])
    .map((item, i) => ({ item, i }))
    .sort((x, y) => comparerDesignations(cle(x.item), cle(y.item)) || x.i - y.i)
    .map((x) => x.item);
}

/** Liste dont chaque élément porte un `produit` : triée par `produit.designation`. */
export function trierParProduit<T extends { produit?: { designation?: string | null } | null }>(
  items: readonly T[] | null | undefined,
): T[] {
  return trierParDesignation(items, (x) => x.produit?.designation);
}
