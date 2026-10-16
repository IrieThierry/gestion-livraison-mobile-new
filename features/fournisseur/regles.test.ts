import type { CommandeResponse, DemandeModificationVersementResponse, LivreurPartenaireDuResponse } from '../../types/api';
import {
  estADeciderParFournisseur,
  libelleMois,
  moisDe,
  moisVoisin,
  nbDemandesADecider,
  peutAvancer,
  resumeCommandes,
  resumeLivreurs,
  tachesFournisseur,
} from './regles';

const commande = (over: Partial<CommandeResponse>) => ({ statut: 'ENVOYEE', ...over }) as CommandeResponse;
const partenaire = (du: number, remiseAReverser = 0) =>
  ({ du, remiseAReverser, livreur: { id: 'l', nom: 'K', prenom: 'A', contact: null } }) as LivreurPartenaireDuResponse;

describe('mois de la synthèse', () => {
  it('mois courant, voisins (changement d’année) et libellé', () => {
    expect(moisDe(new Date(2026, 9, 16))).toBe('2026-10');
    expect(moisVoisin('2026-01', -1)).toBe('2025-12');
    expect(moisVoisin('2026-12', 1)).toBe('2027-01');
    expect(libelleMois('2026-10')).toBe('octobre 2026');
    expect(libelleMois('2026-08')).toBe('août 2026');
    expect(libelleMois('n/a')).toBe('n/a');
  });

  it('pas de mois futur', () => {
    const now = new Date(2026, 9, 16);
    expect(peutAvancer('2026-09', now)).toBe(true);
    expect(peutAvancer('2026-10', now)).toBe(false);
  });
});

describe('resumeCommandes', () => {
  it('en attente (ENVOYEE, montant estimé), à livrer, livrées et montant livré du mois', () => {
    const r = resumeCommandes(
      [
        commande({ statut: 'ENVOYEE', montantEstime: 1000 }),
        commande({ statut: 'ENVOYEE', montantEstime: null }),
        commande({ statut: 'CONFIRMEE' }),
        commande({ statut: 'EN_RECEPTION' }),
        commande({ statut: 'LIVREE', dateLivraison: '2026-10-03T10:00:00', montantLivre: 5000 }),
        commande({ statut: 'LIVREE', dateLivraison: null, dateLivree: '2026-10-20T08:00:00', montantLivre: 300 }),
        commande({ statut: 'LIVREE', dateLivraison: '2026-09-30T10:00:00', montantLivre: 9999 }),
        commande({ statut: 'REFUSEE' }),
        commande({ statut: 'ANNULEE' }),
      ],
      '2026-10',
    );
    expect(r).toEqual({ enAttente: 2, montantEnAttente: 1000, aLivrer: 2, livrees: 2, montantLivre: 5300 });
  });

  it('aucune commande', () => {
    expect(resumeCommandes(undefined, '2026-10')).toEqual({
      enAttente: 0,
      montantEnAttente: 0,
      aLivrer: 0,
      livrees: 0,
      montantLivre: 0,
    });
  });
});

describe('resumeLivreurs', () => {
  it('dû : somme des dûs positifs (les avances ne se déduisent pas), remises à reverser', () => {
    expect(resumeLivreurs([partenaire(2000, 100), partenaire(-500, 50), partenaire(0, -10), partenaire(300)])).toEqual({
      nombre: 4,
      du: 2300,
      debiteurs: 2,
      remiseAReverser: 150,
    });
    expect(resumeLivreurs(undefined)).toEqual({ nombre: 0, du: 0, debiteurs: 0, remiseAReverser: 0 });
  });
});

describe('demandes de modification à décider (même règle que le web)', () => {
  const d = (statut: string, demandeurType: string) =>
    ({ statut, demandeurType }) as DemandeModificationVersementResponse;
  it('en attente et initiée par le livreur', () => {
    expect(estADeciderParFournisseur(d('PENDING', 'LIVREUR'))).toBe(true);
    expect(estADeciderParFournisseur(d('PENDING', 'FOURNISSEUR'))).toBe(false);
    expect(estADeciderParFournisseur(d('APPROVED', 'LIVREUR'))).toBe(false);
    expect(nbDemandesADecider([d('PENDING', 'LIVREUR'), d('PENDING', 'FOURNISSEUR'), d('PENDING', 'LIVREUR')])).toBe(2);
    expect(nbDemandesADecider(undefined)).toBe(0);
  });
});

describe('tachesFournisseur', () => {
  it('une ligne par rubrique non vide, dans l’ordre, avec l’onglet à ouvrir', () => {
    expect(tachesFournisseur({ commandes: 0, invitations: 0, demandes: 0 })).toEqual([]);
    const t = tachesFournisseur({ commandes: 2, invitations: 1, demandes: 3 });
    expect(t.map((x) => [x.code, x.titre, x.lien])).toEqual([
      ['CMD', '2 commandes à confirmer', '/fournisseur/commandes'],
      ['INV', '1 invitation de livreur', '/fournisseur/livreurs/invitations'],
      ['VER', '3 demandes de modification', '/fournisseur/argent/versements/demandes'],
    ]);
    expect(tachesFournisseur({ commandes: 1, invitations: 2, demandes: 1 }).map((x) => x.titre)).toEqual([
      '1 commande à confirmer',
      '2 invitations de livreurs',
      '1 demande de modification',
    ]);
  });
});
