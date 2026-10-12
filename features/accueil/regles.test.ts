import {
  chiffreAccueil,
  filtresDuJour,
  jourLocal,
  produitsVendus,
  nbProduitsRecus,
  nbProduitsVendus,
} from './regles';
import type { MouvementStockResponse, TypeMouvementStock } from '../../types/api';

const mv = (
  type: TypeMouvementStock,
  produit: string,
  quantite: number,
  contrepartie: string | null = null,
  date = '2026-10-10T09:00:00',
): MouvementStockResponse => ({
  date,
  type,
  produit: { id: `id-${produit}`, code: produit, designation: produit },
  quantite,
  reference: null,
  contrepartie,
});

describe('jourLocal / filtresDuJour', () => {
  it('formate le jour local en yyyy-MM-dd', () => {
    expect(jourLocal(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });

  it("début et fin = aujourd'hui", () => {
    expect(filtresDuJour(new Date(2026, 9, 10, 8, 0))).toEqual({
      debut: '2026-10-10',
      fin: '2026-10-10',
    });
  });
});

describe('produitsVendus', () => {
  it('somme les livraisons par produit, sans déduire les retours, tri quantité décroissante', () => {
    const res = produitsVendus([
      mv('LIVRAISON', 'Pain', -5),
      mv('LIVRAISON', 'Lait', -12),
      mv('LIVRAISON', 'Pain', -3),
      mv('RETOUR_EN_STOCK', 'Pain', 4),
      mv('RECEPTION', 'Pain', 50, 'Boulangerie'),
      mv('TRANSFERT_SORTIE', 'Lait', -7),
    ]);
    expect(res).toEqual([
      { produitId: 'id-Lait', designation: 'Lait', quantite: 12 },
      { produitId: 'id-Pain', designation: 'Pain', quantite: 8 },
    ]);
  });

  it("ignore les mouvements d'un autre jour quand le jour est donné", () => {
    const res = produitsVendus(
      [mv('LIVRAISON', 'Pain', -5), mv('LIVRAISON', 'Pain', -9, null, '2026-10-09T18:00:00')],
      '2026-10-10',
    );
    expect(res).toEqual([{ produitId: 'id-Pain', designation: 'Pain', quantite: 5 }]);
  });

  it('liste vide sans livraison', () => {
    expect(produitsVendus([mv('RECEPTION', 'Pain', 10, 'X')])).toEqual([]);
  });

  it('à quantité égale, tri alphabétique', () => {
    const res = produitsVendus([mv('LIVRAISON', 'Sucre', -2), mv('LIVRAISON', 'Beurre', -2)]);
    expect(res.map((l) => l.designation)).toEqual(['Beurre', 'Sucre']);
  });
});

describe('nbProduitsVendus / nbProduitsRecus', () => {
  const mouvements = [
    mv('LIVRAISON', 'Pain', -5),
    mv('LIVRAISON', 'Lait', -12),
    mv('RETOUR_EN_STOCK', 'Pain', 4),
    mv('RECEPTION', 'Pain', 20, 'Boulangerie Kouassi'),
    mv('RECEPTION', 'Lait', 24, 'Laiterie Abidjan'),
    mv('TRANSFERT_ENTREE', 'Lait', 6, 'Apprenti'),
    mv('RECEPTION', 'Pain', 9, 'Boulangerie Kouassi', '2026-10-09T08:00:00'),
  ];

  it('vendus : nombre de produits différents livrés (A×5 + B×3 → 2)', () => {
    expect(nbProduitsVendus(mouvements)).toBe(2);
    expect(nbProduitsVendus([mv('LIVRAISON', 'A', -5), mv('LIVRAISON', 'B', -3), mv('LIVRAISON', 'A', -1)])).toBe(2);
    expect(nbProduitsVendus([])).toBe(0);
  });

  it('réceptionnés : nombre de produits différents reçus du jour, transferts exclus', () => {
    expect(nbProduitsRecus(mouvements, '2026-10-10')).toBe(2);
    expect(nbProduitsRecus([mv('RECEPTION', 'Pain', 20, 'X'), mv('RECEPTION', 'Pain', 5, 'X'), mv('TRANSFERT_ENTREE', 'Lait', 6)])).toBe(1);
    expect(nbProduitsRecus([mv('LIVRAISON', 'Pain', -1)])).toBe(0);
  });
});

describe('chiffreAccueil', () => {
  it('… en chargement, — en erreur, sinon le nombre', () => {
    expect(chiffreAccueil({ isLoading: true, isError: false }, 3)).toBe('…');
    expect(chiffreAccueil({ isLoading: false, isError: true }, 3)).toBe('—');
    expect(chiffreAccueil({ isLoading: false, isError: false }, 0)).toBe('0');
  });
});

describe('mise à zéro (AJUSTEMENT)', () => {
  const mouvements = [
    mv('LIVRAISON', 'Pain', -2),
    mv('AJUSTEMENT', 'Pain', -7, 'Sac percé'),
    mv('AJUSTEMENT', 'Lait', -3),
    mv('RECEPTION', 'Lait', 4, 'Fournisseur A'),
  ];

  it("n'est pas comptée comme une vente", () => {
    expect(produitsVendus(mouvements)).toEqual([{ produitId: 'id-Pain', designation: 'Pain', quantite: 2 }]);
  });

  it("n'apparaît pas dans les réceptions", () => {
    expect(nbProduitsRecus(mouvements)).toBe(1);
  });
});

describe('photo des produits', () => {
  it('reprend la photo du produit pour la vignette', () => {
    const m = mv('LIVRAISON', 'Pain', -2);
    m.produit.photoUrl = '/uploads/produit/p_1.jpg';
    expect(produitsVendus([m])[0].photoUrl).toBe('/uploads/produit/p_1.jpg');
  });
});
