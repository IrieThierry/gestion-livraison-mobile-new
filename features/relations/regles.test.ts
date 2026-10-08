import { actionPermise, etatListePartenaires, etatRelation, LIBELLES_ACTION, LIBELLES_ETAT } from './regles';
import type { StatutRelation } from '../../types/api';

const f = (statut: StatutRelation | null, bloque = false) => ({
  relation: statut
    ? { id: 'r-1', statut, dateInvitation: '2026-10-08T10:00:00', dateDecision: null }
    : null,
  bloque,
});

describe('etatRelation', () => {
  it('jamais invité ou invitation annulée = non invité', () => {
    expect(etatRelation(f(null))).toBe('NON_INVITE');
    expect(etatRelation(f('ANNULEE'))).toBe('NON_INVITE');
  });

  it('un statut par état', () => {
    expect(etatRelation(f('EN_ATTENTE'))).toBe('ENVOYEE');
    expect(etatRelation(f('ACCEPTEE'))).toBe('ACCEPTE');
    expect(etatRelation(f('REFUSEE'))).toBe('REFUSE');
  });

  it('un blocage l’emporte, même avec une relation acceptée', () => {
    expect(etatRelation(f('ACCEPTEE', true))).toBe('BLOQUE');
    expect(etatRelation(f(null, true))).toBe('BLOQUE');
  });
});

describe('actionPermise', () => {
  it('livreur principal : inviter, annuler, réinviter', () => {
    expect(actionPermise('NON_INVITE', true)).toBe('inviter');
    expect(actionPermise('ENVOYEE', true)).toBe('annuler');
    expect(actionPermise('REFUSE', true)).toBe('reinviter');
  });

  it('rien pour accepté ou bloqué', () => {
    expect(actionPermise('ACCEPTE', true)).toBeNull();
    expect(actionPermise('BLOQUE', true)).toBeNull();
  });

  it('apprenti : aucune action', () => {
    for (const e of ['NON_INVITE', 'ENVOYEE', 'ACCEPTE', 'REFUSE', 'BLOQUE'] as const) {
      expect(actionPermise(e, false)).toBeNull();
    }
  });
});

describe('libellés', () => {
  it('identiques au web', () => {
    expect(LIBELLES_ETAT).toEqual({
      NON_INVITE: 'Non invité',
      ENVOYEE: 'Invitation envoyée',
      ACCEPTE: 'Accepté',
      REFUSE: 'Refusé',
      BLOQUE: 'Bloqué',
    });
    expect(LIBELLES_ACTION).toEqual({
      inviter: 'Inviter',
      annuler: "Annuler l'invitation",
      reinviter: 'Réinviter',
    });
  });
});

describe('etatListePartenaires', () => {
  it('chargement, erreur, vide, liste', () => {
    expect(etatListePartenaires({ isLoading: true, isError: false, nombre: 0 })).toBe('chargement');
    expect(etatListePartenaires({ isLoading: false, isError: false, nombre: 0 })).toBe('vide');
    expect(etatListePartenaires({ isLoading: false, isError: false, nombre: 2 })).toBe('liste');
  });

  it('une erreur n’est jamais un état vide', () => {
    expect(etatListePartenaires({ isLoading: false, isError: true, nombre: 0 })).toBe('erreur');
  });
});
