import {
  MESSAGE_SANS_CIBLE,
  MESSAGE_SANS_CLIENT_NI_ZONE,
  ciblesReaffectation,
  demandeReaffectation,
  messageResultat,
  peutReaffecter,
} from './regles';
import type { LivreurResponse } from '../../types/api';

const apprenti = (id: string, prenom: string, actif = true) =>
  ({ id, prenom, nom: 'X', username: id, actif }) as LivreurResponse;

describe('réaffectation par le livreur principal indépendant (P8)', () => {
  it('réservée au livreur principal hors organisation', () => {
    expect(peutReaffecter({ parentId: null })).toBe(true);
    expect(peutReaffecter({ parentId: 'r1' })).toBe(false);
    expect(peutReaffecter({ parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' })).toBe(false);
    expect(peutReaffecter(null)).toBe(false);
  });

  it('cibles : soi-même puis les apprentis actifs triés', () => {
    const cibles = ciblesReaffectation({ id: 'r1', prenom: 'Jean', nom: 'R' }, [
      apprenti('a2', 'Zoé'),
      apprenti('a3', 'Inactif', false),
      apprenti('a1', 'Éric'),
    ]);
    expect(cibles.map((c) => c.id)).toEqual(['r1', 'a1', 'a2']);
    expect(cibles[0].label).toBe('Moi (Jean R)');
  });

  it('demande : clients ou zone, puis cible', () => {
    expect(demandeReaffectation('selection', [], null, 'a1')).toEqual({ erreur: MESSAGE_SANS_CLIENT_NI_ZONE });
    expect(demandeReaffectation('zone', ['c1'], null, 'a1')).toEqual({ erreur: MESSAGE_SANS_CLIENT_NI_ZONE });
    expect(demandeReaffectation('selection', ['c1'], null, null)).toEqual({ erreur: MESSAGE_SANS_CIBLE });
    expect(demandeReaffectation('selection', ['c1', 'c2'], 'z1', 'a1')).toEqual({
      demande: { clientIds: ['c1', 'c2'], livreurId: 'a1' },
    });
    expect(demandeReaffectation('zone', ['c1'], 'z1', 'r1')).toEqual({ demande: { zoneId: 'z1', livreurId: 'r1' } });
  });

  it('message de fin', () => {
    expect(messageResultat(0)).toBe('Aucun client à déplacer : ils sont déjà chez ce livreur.');
    expect(messageResultat(1)).toBe('1 client réaffecté.');
    expect(messageResultat(3)).toBe('3 clients réaffectés.');
  });
});
