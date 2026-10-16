import type { EtatLocalisation } from '../../types/api';
import { enAttente, heure, libelleEtat, libelleRepere, lignesEtat, peutLocaliser } from './etat';

const MAINTENANT = new Date(2026, 9, 16, 14, 40, 0);

const etat = (over: Partial<EtatLocalisation> = {}): EtatLocalisation => ({
  demandeId: 'd1',
  statut: 'ACCEPTEE',
  creeLe: '2026-10-16T14:30:00',
  expireLe: '2026-10-16T14:45:00',
  reponduLe: '2026-10-16T14:32:00',
  position: '5.35,-4.01',
  partageeLe: '2026-10-16T14:32:10',
  repere: null,
  ...over,
});

describe('lignesEtat / libelleEtat (mêmes libellés que le web)', () => {
  it('partagée : « Partagée à 14:32 »', () => {
    expect(lignesEtat(etat(), MAINTENANT)).toEqual(['Partagée à 14:32']);
    expect(libelleEtat(etat(), MAINTENANT)).toBe('Partagée à 14:32');
  });

  it('en attente non expirée : « En attente de réponse… (expire à 14:47) »', () => {
    const e = etat({ statut: 'EN_ATTENTE', expireLe: '2026-10-16T14:47:00', position: null, partageeLe: null, reponduLe: null });
    expect(lignesEtat(e, MAINTENANT)).toEqual(['En attente de réponse… (expire à 14:47)']);
    expect(enAttente(e, MAINTENANT)).toBe(true);
  });

  it('position du jour et nouvelle demande en attente : les deux lignes', () => {
    const e = etat({ statut: 'EN_ATTENTE', expireLe: '2026-10-16T14:47:00', reponduLe: null });
    expect(lignesEtat(e, MAINTENANT)).toEqual(['Partagée à 14:32', 'En attente de réponse… (expire à 14:47)']);
    expect(libelleEtat(e, MAINTENANT)).toBe('Partagée à 14:32 · En attente de réponse… (expire à 14:47)');
  });

  it('refusée : « A refusé à 14:35 » ; expirée (ou heure passée) : « Sans réponse »', () => {
    expect(lignesEtat(etat({ statut: 'REFUSEE', reponduLe: '2026-10-16T14:35:00', position: null }), MAINTENANT)).toEqual([
      'A refusé à 14:35',
    ]);
    expect(lignesEtat(etat({ statut: 'EXPIREE', position: null, reponduLe: null }), MAINTENANT)).toEqual(['Sans réponse']);
    const passee = etat({ statut: 'EN_ATTENTE', expireLe: '2026-10-16T14:39:00', position: null, reponduLe: null });
    expect(enAttente(passee, MAINTENANT)).toBe(false);
    expect(lignesEtat(passee, MAINTENANT)).toEqual(['Sans réponse']);
  });

  it('aucune demande du jour : aucune ligne ; date illisible : heure vide', () => {
    expect(lignesEtat(null, MAINTENANT)).toEqual([]);
    expect(heure('pas une date')).toBe('');
    expect(heure(null)).toBe('');
  });

  it('repère : « près de <client> · <quartier> »', () => {
    expect(libelleRepere({ client: 'Boutique Awa', quartier: 'Riviera 2' })).toBe('près de Boutique Awa · Riviera 2');
    expect(libelleRepere(null)).toBe('');
  });

  it('repère sans quartier : « près de <client> » sans « · null »', () => {
    expect(libelleRepere({ client: 'Boutique Awa', quartier: null })).toBe('près de Boutique Awa');
  });
});

describe('peutLocaliser', () => {
  const independant = { parentId: null, organisationId: null, organisationRole: null };

  it('responsable et commercial : oui', () => {
    expect(peutLocaliser({ parentId: null, organisationId: 'o', organisationRole: 'RESPONSABLE' }, 0)).toBe(true);
    expect(peutLocaliser({ parentId: 'r', organisationId: 'o', organisationRole: 'COMMERCIAL' }, 0)).toBe(true);
  });

  it('livreur principal indépendant : seulement s il a des apprentis', () => {
    expect(peutLocaliser(independant, 2)).toBe(true);
    expect(peutLocaliser(independant, 0)).toBe(false);
  });

  it('apprenti d un principal indépendant : non', () => {
    expect(peutLocaliser({ ...independant, parentId: 'p' }, 3)).toBe(false);
    expect(peutLocaliser(null, 3)).toBe(false);
  });
});
