import {
  filtresDuJour,
  FOURNISSEUR_INCONNU,
  jourLocal,
  produitsVendus,
  receptionsParFournisseur,
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

describe('receptionsParFournisseur', () => {
  it('groupe par fournisseur puis par produit', () => {
    const res = receptionsParFournisseur([
      mv('RECEPTION', 'Pain', 20, 'Boulangerie Kouassi'),
      mv('RECEPTION', 'Croissant', 30, 'Boulangerie Kouassi'),
      mv('RECEPTION', 'Pain', 10, 'Boulangerie Kouassi'),
      mv('RECEPTION', 'Lait', 24, 'Laiterie Abidjan'),
      mv('LIVRAISON', 'Pain', -5),
      mv('TRANSFERT_ENTREE', 'Lait', 6, 'Apprenti'),
    ]);
    expect(res).toEqual([
      {
        fournisseur: 'Boulangerie Kouassi',
        produits: [
          { produitId: 'id-Croissant', designation: 'Croissant', quantite: 30 },
          { produitId: 'id-Pain', designation: 'Pain', quantite: 30 },
        ],
        total: 60,
      },
      {
        fournisseur: 'Laiterie Abidjan',
        produits: [{ produitId: 'id-Lait', designation: 'Lait', quantite: 24 }],
        total: 24,
      },
    ]);
  });

  it('fournisseur absent : groupe dédié', () => {
    const res = receptionsParFournisseur([mv('RECEPTION', 'Pain', 3, null)]);
    expect(res[0].fournisseur).toBe(FOURNISSEUR_INCONNU);
  });

  it('liste vide sans réception', () => {
    expect(receptionsParFournisseur([mv('LIVRAISON', 'Pain', -1)])).toEqual([]);
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
    expect(receptionsParFournisseur(mouvements)).toEqual([
      {
        fournisseur: 'Fournisseur A',
        produits: [{ produitId: 'id-Lait', designation: 'Lait', quantite: 4 }],
        total: 4,
      },
    ]);
  });
});

describe('photo des produits', () => {
  it('reprend la photo du produit pour la vignette', () => {
    const m = mv('LIVRAISON', 'Pain', -2);
    m.produit.photoUrl = '/uploads/produit/p_1.jpg';
    expect(produitsVendus([m])[0].photoUrl).toBe('/uploads/produit/p_1.jpg');
  });
});
