import { totalRetoursParProduit } from './totaux';
import type { RetourResponse } from '../../types/api';

const r = (produit: [string, string], quantite: number, remisEnStock = true) =>
  ({ id: `${produit[0]}-${quantite}`, produit: { id: produit[0], designation: produit[1] }, quantite, remisEnStock }) as RetourResponse;

const PAIN: [string, string] = ['p1', 'Pain'];
const BRIOCHE: [string, string] = ['p2', 'Brioche'];
const CAKE: [string, string] = ['p3', 'Cake'];
const GATEAU: [string, string] = ['p4', 'Gâteau'];

describe('totalRetoursParProduit (même règle que le web)', () => {
  it('liste vide : aucune ligne', () => {
    expect(totalRetoursParProduit([])).toEqual([]);
  });

  it('cumule par produit, corrections déduites, répartition remis en stock / perdu', () => {
    expect(totalRetoursParProduit([r(PAIN, 3), r(PAIN, 2, false), r(PAIN, -1), r(BRIOCHE, 4, false)])).toEqual([
      { produitId: 'p2', designation: 'Brioche', quantite: 4, remisEnStock: 0, perdu: 4 },
      { produitId: 'p1', designation: 'Pain', quantite: 4, remisEnStock: 2, perdu: 2 },
    ]);
  });

  it('tri par quantité décroissante puis désignation ; un produit entièrement corrigé disparaît', () => {
    const lignes = totalRetoursParProduit([r(CAKE, 1), r(GATEAU, 5), r(BRIOCHE, 1), r(PAIN, 2), r(PAIN, -2)]);
    expect(lignes.map((l) => [l.designation, l.quantite])).toEqual([
      ['Gâteau', 5],
      ['Brioche', 1],
      ['Cake', 1],
    ]);
  });
});
