import type { NotificationResponse } from '../../types/api';
import {
  aplatirPages,
  apparenceNotification,
  badgeNonLues,
  cibleMobile,
  curseurSuivant,
  grouperNotifications,
  heureRelative,
  libelleCloche,
  lireDate,
  segmentsTexte,
} from './regles';

const notif = (over: Partial<NotificationResponse> = {}): NotificationResponse => ({
  id: 'n1',
  type: 'TRANSFERT_RECU',
  titre: 'Bon de transfert à valider',
  texte: 'Ali KONÉ t’a envoyé le bon TRF-3 (2 produits).',
  cible: { type: 'TRANSFERT', id: 't1', route: 'transferts.a-decider' },
  auteur: { id: 'a1', nom: 'Ali KONÉ' },
  creeLe: '2026-10-14T09:30:00',
  lue: false,
  ...over,
});

const MAINTENANT = new Date(2026, 9, 14, 12, 0, 0);

describe('heureRelative', () => {
  it.each([
    ['2026-10-14T11:59:40', 'à l’instant'],
    ['2026-10-14T12:05:00', 'à l’instant'],
    ['2026-10-14T11:55:00', 'il y a 5 min'],
    ['2026-10-14T11:00:30', 'il y a 59 min'],
    ['2026-10-14T10:00:00', 'il y a 2 h'],
    ['2026-10-13T13:00:00', 'hier'],
    ['2026-10-13T08:00:00', 'hier'],
    ['2026-10-13T08:00:00', 'hier'],
    ['2026-10-13T23:00:00', 'hier'],
    ['2026-10-12T23:00:00', '12/10/2026'],
    ['2025-01-05T08:00:00', '05/01/2025'],
  ])('%s → %s', (creeLe, attendu) => {
    expect(heureRelative(creeLe, MAINTENANT)).toBe(attendu);
  });

  it('date illisible : vide', () => {
    expect(heureRelative('n/a', MAINTENANT)).toBe('');
    expect(lireDate(null)).toBeNull();
  });
});

describe('grouperNotifications', () => {
  it('Nouveau (non lues), Aujourd’hui (lues du jour), Plus tôt (lues plus anciennes), ordre conservé', () => {
    const g = grouperNotifications(
      [
        notif({ id: 'a', lue: false, creeLe: '2026-10-14T11:00:00' }),
        notif({ id: 'b', lue: true, creeLe: '2026-10-14T10:00:00' }),
        notif({ id: 'c', lue: false, creeLe: '2026-10-10T10:00:00' }),
        notif({ id: 'd', lue: true, creeLe: '2026-10-13T10:00:00' }),
      ],
      MAINTENANT,
    );
    expect(g.map((x) => [x.titre, x.elements.map((n) => n.id)])).toEqual([
      ['Nouveau', ['a', 'c']],
      ['Aujourd’hui', ['b']],
      ['Plus tôt', ['d']],
    ]);
  });

  it('groupes vides omis', () => {
    expect(grouperNotifications([notif({ lue: true, creeLe: '2026-10-01T10:00:00' })], MAINTENANT).map((g) => g.titre)).toEqual([
      'Plus tôt',
    ]);
    expect(grouperNotifications([], MAINTENANT)).toEqual([]);
  });
});

describe('pagination', () => {
  it('curseur = id de la dernière reçue, aucun si la page est incomplète', () => {
    const page = Array.from({ length: 20 }, (_, i) => notif({ id: `n${i}` }));
    expect(curseurSuivant(page)).toBe('n19');
    expect(curseurSuivant(page.slice(0, 5))).toBeUndefined();
    expect(curseurSuivant([])).toBeUndefined();
  });

  it('pages aplaties sans doublon', () => {
    expect(aplatirPages([[notif({ id: 'a' }), notif({ id: 'b' })], [notif({ id: 'b' }), notif({ id: 'c' })]]).map((n) => n.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(aplatirPages(undefined)).toEqual([]);
  });
});

describe('segmentsTexte', () => {
  it('nom de l’auteur et références en gras', () => {
    expect(segmentsTexte('Ali KONÉ t’a envoyé le bon TRF-3 (2 produits).', ['Ali KONÉ'])).toEqual([
      { texte: 'Ali KONÉ', gras: true },
      { texte: ' t’a envoyé le bon ', gras: false },
      { texte: 'TRF-3', gras: true },
      { texte: ' (2 produits).', gras: false },
    ]);
  });

  it('fournisseur, montant et motif : seuls le nom et la référence', () => {
    const s = segmentsTexte('BRASSERIE DU SUD a refusé la commande CMDE-5 : Rupture.', ['BRASSERIE DU SUD']);
    expect(s.filter((x) => x.gras).map((x) => x.texte)).toEqual(['BRASSERIE DU SUD', 'CMDE-5']);
    expect(s.map((x) => x.texte).join('')).toBe('BRASSERIE DU SUD a refusé la commande CMDE-5 : Rupture.');
  });

  it('sans auteur ni référence : un seul segment normal', () => {
    expect(segmentsTexte('Un utilisateur t’a confié 3 clients.', [null])).toEqual([
      { texte: 'Un utilisateur t’a confié 3 clients.', gras: false },
    ]);
  });

  it('caractères spéciaux du nom échappés', () => {
    expect(segmentsTexte('A. (B) a annulé.', ['A. (B)'])[0]).toEqual({ texte: 'A. (B)', gras: true });
  });
});

describe('heureRelative : passage de minuit', () => {
  it('23:00 vu à 01:00 : « hier » (cohérent avec le groupe « Plus tôt »)', () => {
    expect(heureRelative('2026-10-13T23:00:00', new Date(2026, 9, 14, 1, 0, 0))).toBe('hier');
    expect(heureRelative('2026-10-14T00:10:00', new Date(2026, 9, 14, 1, 0, 0))).toBe('il y a 50 min');
  });
});

describe('apparenceNotification : annulations et retraits', () => {
  it('annulé : gris ; clients retirés : ambre', () => {
    expect(apparenceNotification(notif({ type: 'TRANSFERT_ANNULE' }))).toMatchObject({ ton: 'neutre', couleur: '#64748b' });
    expect(apparenceNotification(notif({ type: 'COMMANDE_ANNULEE' })).couleur).toBe('#64748b');
    expect(apparenceNotification(notif({ type: 'CLIENTS_RETIRES' })).couleur).toBe('#d97706');
  });
});

describe('apparenceNotification', () => {
  it('domaine par cible, ton par issue', () => {
    expect(apparenceNotification(notif())).toMatchObject({ domaine: 'transfert', ton: 'neutre' });
    expect(apparenceNotification(notif({ type: 'TRANSFERT_ACCEPTE' }))).toMatchObject({ ton: 'positif', couleur: '#065f46' });
    expect(apparenceNotification(notif({ type: 'REMISE_CONTESTEE', cible: { type: 'REMISE_ARGENT', id: 'r', route: 'remises.mes-remises' } }))).toMatchObject({
      domaine: 'remise',
      ton: 'negatif',
      couleur: '#dc2626',
    });
    expect(apparenceNotification(notif({ type: 'INVITATION_RECUE', cible: { type: 'INCONNU', id: null, route: 'x' } })).domaine).toBe('relation');
    expect(apparenceNotification(notif({ type: 'AUTRE', cible: { type: 'INCONNU', id: null, route: 'x' } })).domaine).toBe('autre');
  });
});

describe('cibleMobile', () => {
  const livreur = { apprenti: false, responsable: false };
  const cible = (route: string, id: string | null = 'x1') => notif({ cible: { type: 'X', id, route } });
  const depuis = { depuis: 'notifications' };

  it.each([
    ['transferts.a-decider', '/(livreur)/stock/transferts'],
    ['transferts', '/(livreur)/stock/transferts'],
    ['remises.recues', '/(livreur)/profil/remises-apprentis'],
    ['remises.mes-remises', '/(livreur)/profil/remises'],
    ['versements.demandes-modif', '/(livreur)/cash/versements/demandes'],
    ['commandes', '/(livreur)/cash/commandes/x1'],
    ['demandes-chargement', '/(livreur)/stock/demandes'],
    ['clients', '/(livreur)/clients'],
    ['clotures', '/(livreur)/clotures'],
    ['fournisseurs', '/(livreur)/profil/fournisseurs'],
  ])('%s → %s', (route, href) => {
    expect(cibleMobile(cible(route), livreur)).toEqual({ href, params: depuis });
  });

  it('routes sans écran mobile (fournisseur, responsable) : null', () => {
    for (const r of ['fournisseur.commandes', 'fournisseur.invitations', 'organisation.demandes-chargement', 'inconnue']) {
      expect(cibleMobile(cible(r), livreur)).toBeNull();
    }
  });

  it('commande sans id : liste (à réceptionner pour l’apprenti)', () => {
    expect(cibleMobile(cible('commandes', null), livreur)?.href).toBe('/(livreur)/cash/commandes');
    expect(cibleMobile(cible('commandes', null), { apprenti: true, responsable: false })?.href).toBe(
      '/(livreur)/cash/commandes/a-receptionner',
    );
  });

  it('responsable : seulement les écrans de son espace, retour à son onglet', () => {
    const resp = { apprenti: false, responsable: true };
    expect(cibleMobile(cible('transferts'), resp)).toEqual({
      href: '/(livreur)/stock/transferts',
      params: { depuis: 'notifications-responsable' },
    });
    expect(cibleMobile(cible('remises.recues'), resp)?.href).toBe('/(livreur)/profil/remises-apprentis');
    expect(cibleMobile(cible('clients'), resp)).toBeNull();
    expect(cibleMobile(cible('commandes'), resp)).toBeNull();
  });
});

describe('cloche', () => {
  it('badge et libellé', () => {
    expect(badgeNonLues(7)).toBe('7');
    expect(badgeNonLues(100)).toBe('99+');
    expect(libelleCloche(0, 0)).toBe('Notifications : 0 non lue');
    expect(libelleCloche(1, 0)).toBe('Notifications : 1 non lue');
    expect(libelleCloche(3, 2)).toBe('Notifications : 3 non lues, 2 à traiter');
  });
});

describe('« Mot de passe demandé » (M1)', () => {
  const n = notif({ type: 'MOT_DE_PASSE_DEMANDE', cible: { type: 'COMPTE', id: 'a1', route: 'inconnue' } });

  it('ouvre la liste des apprentis (livreur) ou des commerciaux (responsable), retour aux Notifications', () => {
    expect(cibleMobile(n, { apprenti: false, responsable: false })).toEqual({
      href: '/(livreur)/profil/apprentis',
      params: { depuis: 'notifications' },
    });
    expect(cibleMobile(n, { apprenti: false, responsable: true })).toEqual({
      href: '/(livreur)/profil/apprentis',
      params: { depuis: 'notifications-responsable' },
    });
    expect(cibleMobile(notif({ cible: { type: 'X', id: null, route: 'equipe' } }), { apprenti: false, responsable: false })?.href).toBe(
      '/(livreur)/profil/apprentis',
    );
  });

  it('apparence : domaine « compte »', () => {
    expect(apparenceNotification(n)).toMatchObject({ domaine: 'compte', ton: 'neutre', couleur: '#047857' });
  });
});
