import {
  construireCommande,
  construireModificationReception,
  construireReception,
  dateReceptionParam,
  estReglable,
  estTitulaireCommande,
  FILTRES_STATUT_COMMANDE,
  lignesCommandables,
  peutAnnuler,
  peutChangerApprenti,
  peutCorrigerReception,
  peutPasserLivree,
  peutReceptionner,
  quantiteDansReception,
  quantitesDeReception,
  reliquat,
  remisePartenaire,
} from './regles';
import type { ProduitFournisseurResponse } from '../../types/api';
import { commandeFixture, ligneCommandeFixture, receptionFixture } from './commande.fixture';

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
  it('commence par « Toutes » et couvre les six statuts, dont « En réception »', () => {
    expect(FILTRES_STATUT_COMMANDE[0]?.valeur).toBe('TOUTES');
    expect(FILTRES_STATUT_COMMANDE).toContainEqual({ valeur: 'EN_RECEPTION', label: 'En réception' });
    const valeurs = FILTRES_STATUT_COMMANDE.map((f) => f.valeur);
    for (const s of ['ENVOYEE', 'CONFIRMEE', 'EN_RECEPTION', 'LIVREE', 'REFUSEE', 'ANNULEE']) {
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

describe('remisePartenaire', () => {
  it('lit la remise partenaire commune à toutes les lignes', () => {
    expect(remisePartenaire([ligne('Pain', { remiseLivreur: 15 }), ligne('Lait', { remiseLivreur: 15 })])).toBe(15);
  });

  it('vaut 0 sans ligne ou sans remise, et ne dépend pas du prix particulier', () => {
    expect(remisePartenaire([])).toBe(0);
    expect(remisePartenaire([ligne('Pain', { remiseLivreur: 0, prixParticulier: true })])).toBe(0);
  });
});

// ─── Réceptions (lot C) ───────────────────────────────────────────────────

const baguette = ligneCommandeFixture('p1', 'Baguette', 10, 4); // restant 6
const pain = ligneCommandeFixture('p2', 'Pain', 5, 5); // restant 0
const croissant = ligneCommandeFixture('p3', 'Croissant', 8); // restant 8

describe('droits de réception', () => {
  it('réceptionner : confirmée ou en réception seulement', () => {
    expect(peutReceptionner(commandeFixture({ statut: 'CONFIRMEE' }))).toBe(true);
    expect(peutReceptionner(commandeFixture({ statut: 'EN_RECEPTION' }))).toBe(true);
    for (const s of ['ENVOYEE', 'LIVREE', 'REFUSEE', 'ANNULEE'] as const) {
      expect(peutReceptionner(commandeFixture({ statut: s }))).toBe(false);
    }
  });

  it('passer à Livrée : en réception seulement', () => {
    expect(peutPasserLivree(commandeFixture({ statut: 'EN_RECEPTION' }))).toBe(true);
    for (const s of ['ENVOYEE', 'CONFIRMEE', 'LIVREE', 'REFUSEE', 'ANNULEE'] as const) {
      expect(peutPasserLivree(commandeFixture({ statut: s }))).toBe(false);
    }
  });

  it('corriger une réception : titulaire, réception active, commande non réglée', () => {
    const c = commandeFixture({ statut: 'LIVREE', versementId: null });
    const r = receptionFixture();
    expect(peutCorrigerReception(c, r, true)).toBe(true);
    expect(peutCorrigerReception(c, r, false)).toBe(false);
    expect(peutCorrigerReception(c, receptionFixture({ annulee: true }), true)).toBe(false);
    expect(peutCorrigerReception({ ...c, versementId: 'v-1' }, r, true)).toBe(false);
  });

  it("changer l'apprenti : titulaire, commande envoyée, confirmée ou en réception", () => {
    for (const s of ['ENVOYEE', 'CONFIRMEE', 'EN_RECEPTION'] as const) {
      expect(peutChangerApprenti(commandeFixture({ statut: s }), true)).toBe(true);
      expect(peutChangerApprenti(commandeFixture({ statut: s }), false)).toBe(false);
    }
    for (const s of ['LIVREE', 'REFUSEE', 'ANNULEE'] as const) {
      expect(peutChangerApprenti(commandeFixture({ statut: s }), true)).toBe(false);
    }
  });

  it('titulaire : livreur principal de la commande', () => {
    const c = commandeFixture(); // livreur l-1
    expect(estTitulaireCommande(c, { id: 'l-1', parentId: null })).toBe(true);
    expect(estTitulaireCommande(c, { id: 'l-1' })).toBe(true);
    expect(estTitulaireCommande(c, { id: 'l-2', parentId: null })).toBe(false);
    expect(estTitulaireCommande(c, { id: 'a-1', parentId: 'l-1' })).toBe(false);
    expect(estTitulaireCommande(c, null)).toBe(false);
  });

  it('reliquat : lignes avec une quantité restante', () => {
    const c = commandeFixture({ produitsCommandes: [baguette, pain, croissant] });
    expect(reliquat(c).map((l) => l.produit.id)).toEqual(['p1', 'p3']);
    expect(reliquat(commandeFixture({ produitsCommandes: [pain] }))).toEqual([]);
  });
});

describe('construireReception', () => {
  const lignes = [baguette, pain, croissant];

  it('garde les quantités > 0, champ vide = 0', () => {
    expect(construireReception(lignes, { p1: '6', p2: '', p3: '0' })).toEqual({
      ok: true,
      valeur: { lignes: [{ produitId: 'p1', quantite: 6 }] },
    });
  });

  it('ajoute la date quand elle est fournie', () => {
    expect(construireReception(lignes, { p3: '2' }, '2026-10-05T00:00:00')).toEqual({
      ok: true,
      valeur: { dateReception: '2026-10-05T00:00:00', lignes: [{ produitId: 'p3', quantite: 2 }] },
    });
  });

  it('refuse un négatif, un décimal ou du texte', () => {
    for (const v of ['-1', '1.5', 'abc']) {
      expect(construireReception(lignes, { p1: v })).toEqual({
        ok: false,
        erreur: 'La quantité reçue de Baguette doit être un entier supérieur ou égal à 0.',
      });
    }
  });

  it('refuse plus que le restant', () => {
    expect(construireReception(lignes, { p1: '7' })).toEqual({
      ok: false,
      erreur: 'Au plus 6 pour Baguette.',
    });
    expect(construireReception(lignes, { p2: '1' })).toEqual({
      ok: false,
      erreur: 'Au plus 0 pour Pain.',
    });
  });

  it('exige au moins une quantité reçue (vide ou tout à 0)', () => {
    const attendu = { ok: false, erreur: 'Saisissez au moins une quantité reçue.' };
    expect(construireReception(lignes, {})).toEqual(attendu);
    expect(construireReception(lignes, { p1: '0', p3: ' ' })).toEqual(attendu);
  });
});

describe('construireModificationReception', () => {
  // REC-1 : 4 baguettes et 5 pains (tout le reçu de la commande).
  const r = receptionFixture({
    lignes: [
      { produit: baguette.produit, quantite: 4, prixUnitaire: 100, remiseLivreurUnitaire: 10 },
      { produit: pain.produit, quantite: 5, prixUnitaire: 200, remiseLivreurUnitaire: 0 },
    ],
  });
  const c = commandeFixture({
    statut: 'EN_RECEPTION',
    produitsCommandes: [baguette, pain, croissant],
    receptions: [r],
  });

  it('pré-remplit la saisie avec les quantités de la réception', () => {
    expect(quantitesDeReception(r)).toEqual({ p1: '4', p2: '5' });
    expect(quantiteDansReception(r, 'p3')).toBe(0);
  });

  it('envoie le contenu complet : ligne gardée, ligne retirée (0), produit ajouté', () => {
    expect(construireModificationReception(c, r, { p1: '4', p2: '0', p3: '3' })).toEqual({
      ok: true,
      valeur: {
        lignes: [
          { produitId: 'p1', quantite: 4 },
          { produitId: 'p3', quantite: 3 },
        ],
      },
    });
  });

  it('borne = restant + quantité actuelle de la réception', () => {
    // Baguette : restant 6 + 4 de REC-1 = 10.
    expect(construireModificationReception(c, r, { p1: '10' }).ok).toBe(true);
    expect(construireModificationReception(c, r, { p1: '11' })).toEqual({
      ok: false,
      erreur: 'Au plus 10 pour Baguette.',
    });
    // Pain : restant 0 + 5 = 5.
    expect(construireModificationReception(c, r, { p2: '6' })).toEqual({
      ok: false,
      erreur: 'Au plus 5 pour Pain.',
    });
  });

  it('refuse un négatif et une saisie toute à 0', () => {
    expect(construireModificationReception(c, r, { p1: '-2' })).toEqual({
      ok: false,
      erreur: 'La quantité reçue de Baguette doit être un entier supérieur ou égal à 0.',
    });
    expect(construireModificationReception(c, r, { p1: '0', p2: '0' })).toEqual({
      ok: false,
      erreur: 'Saisissez au moins une quantité reçue ; pour tout retirer, annulez la réception.',
    });
  });

  it('ajoute la date fournie', () => {
    const v = construireModificationReception(c, r, { p1: '1' }, '2026-10-03T00:00:00');
    expect(v).toEqual({
      ok: true,
      valeur: { dateReception: '2026-10-03T00:00:00', lignes: [{ produitId: 'p1', quantite: 1 }] },
    });
  });
});

describe('dateReceptionParam', () => {
  it('rien pour aucune date ou la date inchangée, sinon le jour à 00:00', () => {
    expect(dateReceptionParam(null, '2026-10-08')).toBeUndefined();
    expect(dateReceptionParam('2026-10-08', '2026-10-08')).toBeUndefined();
    expect(dateReceptionParam('2026-10-06', '2026-10-08')).toBe('2026-10-06T00:00:00');
  });
});
