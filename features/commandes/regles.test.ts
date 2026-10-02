import {
  construireCommande,
  estReglable,
  FILTRES_STATUT_COMMANDE,
  peutAnnuler,
} from './regles';
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
