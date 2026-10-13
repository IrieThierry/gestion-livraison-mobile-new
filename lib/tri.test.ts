import { comparerDesignations, trierParDesignation, trierParProduit } from './tri';

describe('tri des produits par désignation (P3)', () => {
  it('ordre alphabétique français, accents et majuscules ignorés', () => {
    const noms = ['pain', 'Éclair', 'baguette', 'Croissant', 'eau', 'Écrou'];
    expect(trierParDesignation(noms, (n) => n)).toEqual(['baguette', 'Croissant', 'eau', 'Éclair', 'Écrou', 'pain']);
  });

  it('stable entre désignations équivalentes, désignation absente en dernier', () => {
    const items = [
      { id: 1, d: 'Pain' },
      { id: 2, d: null },
      { id: 3, d: 'pain' },
      { id: 4, d: 'Beignet' },
    ];
    expect(trierParDesignation(items, (x) => x.d).map((x) => x.id)).toEqual([4, 1, 3, 2]);
    expect(comparerDesignations('é', 'E')).toBe(0);
  });

  it('listes portant un produit, sans modifier la liste d’origine', () => {
    const lignes = [{ produit: { designation: 'Sucre' } }, { produit: { designation: 'farine' } }];
    expect(trierParProduit(lignes).map((l) => l.produit.designation)).toEqual(['farine', 'Sucre']);
    expect(lignes[0].produit.designation).toBe('Sucre');
    expect(trierParProduit(undefined)).toEqual([]);
  });
});
