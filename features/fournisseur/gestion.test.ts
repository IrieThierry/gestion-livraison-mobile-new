import type { CommandeResponse, LivreurPartenaireDuResponse } from '../../types/api';
import {
  FILTRES_COMMANDES_FOURNISSEUR,
  MESSAGE_MOTIF_REFUS,
  PERIODES_COMMANDES,
  commandesAReglerDe,
  filtrerCommandes,
  filtrerPartenaires,
  libelleDu,
  lireMotifRefus,
  lirePrixParticulier,
  lireRemiseLivreur,
  nomLivreur,
  peutConfirmer,
  peutRefuser,
  validerVersementRecu,
} from './gestion';
import { bornesPeriode } from '../../lib/periode';

const cmd = (over: Partial<CommandeResponse>) =>
  ({
    id: 'c',
    reference: 'CMDE-1',
    statut: 'ENVOYEE',
    date: '2026-10-10T08:00:00',
    versementId: null,
    livreur: { id: 'l1', nom: 'Yao', prenom: 'Awa' },
    ...over,
  }) as CommandeResponse;

describe('FM2 : commandes reçues', () => {
  it('filtres du portail web : « À traiter » = envoyées', () => {
    expect(FILTRES_COMMANDES_FOURNISSEUR.map((f) => f.label)).toEqual([
      'Toutes',
      'À traiter',
      'Confirmées',
      'En réception',
      'Livrées',
      'Refusées',
      'Annulées',
    ]);
    expect(FILTRES_COMMANDES_FOURNISSEUR[1].valeur).toBe('ENVOYEE');
  });

  it('actions selon le statut : confirmer une envoyée ; refuser une envoyée ou une confirmée', () => {
    expect(peutConfirmer({ statut: 'ENVOYEE' })).toBe(true);
    expect(peutConfirmer({ statut: 'CONFIRMEE' })).toBe(false);
    expect(peutRefuser({ statut: 'ENVOYEE' })).toBe(true);
    expect(peutRefuser({ statut: 'CONFIRMEE' })).toBe(true);
    for (const statut of ['EN_RECEPTION', 'LIVREE', 'REFUSEE', 'ANNULEE'] as const) {
      expect(peutConfirmer({ statut })).toBe(false);
      expect(peutRefuser({ statut })).toBe(false);
    }
  });

  it('liste : plus récentes d’abord, puis statut, période et recherche (référence, livreur)', () => {
    const liste = [
      cmd({ id: 'a', reference: 'CMDE-1', date: '2026-09-01T08:00:00' }),
      cmd({ id: 'b', reference: 'CMDE-2', statut: 'LIVREE', date: '2026-10-12T08:00:00' }),
      cmd({ id: 'c', reference: 'CMDE-3', date: '2026-10-14T08:00:00', livreur: { id: 'l2', nom: 'Konan', prenom: 'Marc' } as never }),
    ];
    const tout = { statut: 'TOUTES' as const, bornes: {}, recherche: '' };
    expect(filtrerCommandes(liste, tout).map((c) => c.id)).toEqual(['c', 'b', 'a']);
    expect(filtrerCommandes(liste, { ...tout, statut: 'ENVOYEE' }).map((c) => c.id)).toEqual(['c', 'a']);
    const octobre = bornesPeriode({ cle: 'mois' }, PERIODES_COMMANDES, new Date(2026, 9, 16));
    expect(filtrerCommandes(liste, { ...tout, bornes: octobre }).map((c) => c.id)).toEqual(['c', 'b']);
    expect(filtrerCommandes(liste, { ...tout, recherche: 'marc' }).map((c) => c.id)).toEqual(['c']);
    expect(filtrerCommandes(liste, { ...tout, recherche: 'cmde-2' }).map((c) => c.id)).toEqual(['b']);
    expect(filtrerCommandes(undefined, tout)).toEqual([]);
    // « Tout » : aucune borne.
    expect(bornesPeriode({ cle: 'tout' }, PERIODES_COMMANDES)).toEqual({});
  });

  it('motif du refus obligatoire (spec F2), nettoyé', () => {
    expect(lireMotifRefus('   ')).toEqual({ ok: false, erreur: MESSAGE_MOTIF_REFUS });
    expect(lireMotifRefus('  rupture de stock ')).toEqual({ ok: true, motif: 'rupture de stock' });
  });
});

describe('FM2 : livreurs partenaires', () => {
  const p = (nom: string, prenom: string | null, contact: string | null = null) =>
    ({ livreur: { id: nom, nom, prenom, contact }, du: 0 }) as LivreurPartenaireDuResponse;

  it('nom : prénom absent ignoré', () => {
    expect(nomLivreur({ nom: 'Yao', prenom: 'Awa' })).toBe('Awa Yao');
    expect(nomLivreur({ nom: 'Yao', prenom: null })).toBe('Yao');
  });

  it('tri par nom et recherche par nom ou contact', () => {
    const liste = [p('Yao', 'Awa', '0701'), p('Konan', 'Marc', '0502'), p('Bamba', null)];
    // Par nom affiché : « Awa Yao », « Bamba », « Marc Konan ».
    expect(filtrerPartenaires(liste, '').map((x) => x.livreur.nom)).toEqual(['Yao', 'Bamba', 'Konan']);
    expect(filtrerPartenaires(liste, '0502').map((x) => x.livreur.nom)).toEqual(['Konan']);
  });

  it('dû négatif = avance', () => {
    expect(libelleDu(7000)).toEqual({ libelle: 'Dû', montant: 7000 });
    expect(libelleDu(-500)).toEqual({ libelle: 'Avance', montant: 500 });
  });

  it('remise livreur : vide = 0, ≥ 0, 2 décimales, virgule acceptée', () => {
    expect(lireRemiseLivreur('')).toEqual({ ok: true, valeur: 0 });
    expect(lireRemiseLivreur('25,5')).toEqual({ ok: true, valeur: 25.5 });
    expect(lireRemiseLivreur('-3')).toEqual({ ok: false, erreur: 'La remise livreur ne peut pas être négative.' });
    expect(lireRemiseLivreur('1.234')).toEqual({ ok: false, erreur: 'La remise livreur : 2 décimales au plus.' });
    expect(lireRemiseLivreur('abc')).toEqual({
      ok: false,
      erreur: 'La remise livreur : saisis un nombre (chiffres, virgule ou point, 2 décimales au plus).',
    });
    expect(lireRemiseLivreur('1234567890123')).toEqual({ ok: false, erreur: 'La remise livreur : montant trop élevé.' });
  });

  it('prix particulier : obligatoire et > 0', () => {
    expect(lirePrixParticulier(' ')).toEqual({ ok: false, erreur: 'Renseigne un prix particulier.' });
    expect(lirePrixParticulier('0')).toEqual({ ok: false, erreur: 'Le prix particulier doit être supérieur à 0.' });
    expect(lirePrixParticulier('-2')).toEqual({ ok: false, erreur: 'Le prix particulier doit être supérieur à 0.' });
    expect(lirePrixParticulier('120')).toEqual({ ok: true, valeur: 120 });
  });

  it('versement : commandes livrées non réglées du livreur ; versement libre > 0', () => {
    const liste = [
      cmd({ id: 'a', statut: 'LIVREE' }),
      cmd({ id: 'b', statut: 'LIVREE', versementId: 'v1' }),
      cmd({ id: 'c', statut: 'CONFIRMEE' }),
      cmd({ id: 'd', statut: 'LIVREE', livreur: { id: 'l2' } as never }),
    ];
    expect(commandesAReglerDe(liste, 'l1').map((c) => c.id)).toEqual(['a']);
    expect(validerVersementRecu({ montant: '', nbCommandes: 1 })).toBe('Saisis un montant.');
    expect(validerVersementRecu({ montant: '0', nbCommandes: 0 })).toBe(
      'Un versement libre (sans commande cochée) doit avoir un montant supérieur à 0.',
    );
    expect(validerVersementRecu({ montant: '0', nbCommandes: 2 })).toBeNull();
    expect(validerVersementRecu({ montant: '5000', nbCommandes: 0 })).toBeNull();
  });
});
