import { prixCatalogueParProduit, produitsAchetables, totalIndicatifAchat } from './regles';
import type { ProduitFournisseurResponse } from '../../types/api';

const ligne = (
  designation: string,
  prixDeVente: number,
  extra: Partial<ProduitFournisseurResponse> = {},
): ProduitFournisseurResponse => ({
  id: designation,
  produit: { id: 'p-' + designation, code: designation, designation },
  fournisseur: { id: 'f-1', code: 'F-001', libelle: 'F', interlocuteur: '', contact: '' },
  prixDeVente,
  remiseLivreur: 10,
  actif: true,
  prixParticulier: false,
  ...extra,
});

describe('produitsAchetables', () => {
  it('écarte les lignes inactives et trie par désignation', () => {
    const res = produitsAchetables([
      ligne('Pain', 100),
      ligne('Baguette', 100),
      ligne('Brioche', 100, { actif: false }),
    ]);
    expect(res.map((p) => p.designation)).toEqual(['Baguette', 'Pain']);
  });
});

describe('totalIndicatifAchat', () => {
  const catalogue = [ligne('Pain', 150), ligne('Baguette', 250)];

  it('somme quantité × prix du catalogue', () => {
    const total = totalIndicatifAchat(
      [
        { produitId: 'p-Pain', qte: 3 },
        { produitId: 'p-Baguette', qte: 2 },
      ],
      catalogue,
    );
    expect(total).toBe(950);
  });

  it('compte 0 pour un produit hors catalogue', () => {
    expect(
      totalIndicatifAchat(
        [
          { produitId: 'p-Pain', qte: 1 },
          { produitId: 'inconnu', qte: 5 },
        ],
        catalogue,
      ),
    ).toBe(150);
  });
});

describe('prixCatalogueParProduit', () => {
  it('associe chaque produit à son prix de vente du catalogue', () => {
    const m = prixCatalogueParProduit([ligne('Pain', 150), ligne('Lait', 400)]);
    expect(m.get('p-Pain')).toBe(150);
    expect(m.get('p-Lait')).toBe(400);
    expect(m.get('inconnu')).toBeUndefined();
  });
});
