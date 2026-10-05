import {
  construireCommande,
  estReglable,
  FILTRES_STATUT_COMMANDE,
  lignesCommandables,
  peutAnnuler,
} from './regles';
import type { ProduitFournisseurResponse } from '../../types/api';
import { commandeFixture } from './commande.fixture';

describe('droits par statut', () => {
  it('annuler : seulement une commande envoyée', () => {
    expect(peutAnnuler(commandeFixture({ statut: 'ENVOYEE' }))).toBe(true);
    for (const s of ['CONFIRMEE', 'REFUSEE', 'ANNULEE', 'LIVREE'] as const) {
      expect(peutAnnuler(commandeFixture({ statut: s }))).toBe(false);
    }
  });

  it('réglable : livrée et pas encore rattachée à un versement', () => {
    expect(estReglable(commandeFixture({ statut: 'LIVREE', versementId: null }))).toBe(true);
    expect(estReglable(commandeFixture({ statut: 'LIVREE', versementId: 'v-1' }))).toBe(false);
    expect(estReglable(commandeFixture({ statut: 'CONFIRMEE', versementId: null }))).toBe(false);
  });
});

describe('FILTRES_STATUT_COMMANDE', () => {
  it('commence par « Toutes » et couvre les cinq statuts', () => {
    expect(FILTRES_STATUT_COMMANDE[0]?.valeur).toBe('TOUTES');
    const valeurs = FILTRES_STATUT_COMMANDE.map((f) => f.valeur);
    for (const s of ['ENVOYEE', 'CONFIRMEE', 'LIVREE', 'REFUSEE', 'ANNULEE']) {
      expect(valeurs).toContain(s);
    }
  });
});

describe('construireCommande', () => {
  it('exige un fournisseur', () => {
    expect(construireCommande('', { p1: '5' }).ok).toBe(false);
  });

  it('ignore les quantités vides et garde les lignes saisies', () => {
    const r = construireCommande('f-1', { p1: '5', p2: '', p3: '  ' });
    expect(r).toEqual({
      ok: true,
      valeur: { fournisseurId: 'f-1', produitsCommandes: [{ produitId: 'p1', qteCommandee: 5 }] },
    });
  });

  it('exige au moins une quantité', () => {
    expect(construireCommande('f-1', { p1: '' }).ok).toBe(false);
    expect(construireCommande('f-1', {}).ok).toBe(false);
  });

  it('refuse zéro, négatif, décimal et texte', () => {
    expect(construireCommande('f-1', { p1: '0' }).ok).toBe(false);
    expect(construireCommande('f-1', { p1: '-2' }).ok).toBe(false);
    expect(construireCommande('f-1', { p1: '2.5' }).ok).toBe(false);
    expect(construireCommande('f-1', { p1: 'abc' }).ok).toBe(false);
  });
});

const ligne = (
  designation: string,
  extra: Partial<ProduitFournisseurResponse> = {},
): ProduitFournisseurResponse => ({
  id: designation,
  produit: { id: 'p-' + designation, code: designation, designation },
  fournisseur: { id: 'f-1', code: 'F-001', libelle: 'F', interlocuteur: '', contact: '' },
  prixDeVente: 100,
  remiseLivreur: 10,
  actif: true,
  prixParticulier: false,
  ...extra,
});

describe('lignesCommandables', () => {
  it('écarte les lignes inactives et trie par désignation', () => {
    const res = lignesCommandables([
      ligne('Pain'),
      ligne('Baguette'),
      ligne('Brioche', { actif: false }),
    ]);
    expect(res.map((l) => l.produit.designation)).toEqual(['Baguette', 'Pain']);
  });

  it('garde une ligne dont actif est absent (défense)', () => {
    const sansActif = { ...ligne('Croissant') } as Partial<ProduitFournisseurResponse>;
    delete sansActif.actif;
    expect(lignesCommandables([sansActif as ProduitFournisseurResponse])).toHaveLength(1);
  });

  it('conserve remise livreur et prix particulier', () => {
    const [l] = lignesCommandables([ligne('Pain', { prixParticulier: true, remiseLivreur: 5 })]);
    expect(l?.prixParticulier).toBe(true);
    expect(l?.remiseLivreur).toBe(5);
  });
});
