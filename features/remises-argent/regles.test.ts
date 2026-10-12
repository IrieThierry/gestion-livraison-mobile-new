import {
  COMMENTAIRE_REMISE_MAX,
  construireContestation,
  construireDeclaration,
  dernieresRemises,
  LIBELLE_STATUT_REMISE,
  MESSAGE_MONTANT_REMISE,
  MESSAGE_MOTIF_CONTESTATION,
  nbRemisesAConfirmer,
  peutAnnuler,
  peutDecider,
} from './regles';
import type { RemiseArgentResponse, StatutRemiseArgent } from '../../types/api';

const remise = (id: string, date: string, statut: StatutRemiseArgent = 'DECLAREE', reference = `REM-${id}`) =>
  ({ id, reference, montant: 1000, dateRemise: date, statut }) as RemiseArgentResponse;

describe('remises d’argent : règles', () => {
  it('libellés des statuts', () => {
    expect(LIBELLE_STATUT_REMISE).toEqual({
      DECLAREE: 'Déclarée',
      CONFIRMEE: 'Confirmée',
      CONTESTEE: 'Contestée',
      ANNULEE: 'Annulée',
    });
  });

  it('déclaration : montant > 0, commentaire nettoyé, vide = absent', () => {
    expect(construireDeclaration('5 000', '  pour hier ')).toEqual({
      ok: true,
      valeur: { montant: 5000, commentaire: 'pour hier' },
    });
    expect(construireDeclaration('2500,5', '   ')).toEqual({ ok: true, valeur: { montant: 2500.5 } });
  });

  it('déclaration : montant nul ou absent refusé avec le message du back', () => {
    expect(construireDeclaration('0', '')).toEqual({ ok: false, erreur: MESSAGE_MONTANT_REMISE });
    expect(MESSAGE_MONTANT_REMISE).toBe('Le montant doit être supérieur à 0.');
    expect(construireDeclaration('', '')).toEqual({ ok: false, erreur: 'Saisis un montant.' });
    expect(construireDeclaration('abc', '').ok).toBe(false);
  });

  it('déclaration : commentaire de plus de 500 caractères refusé', () => {
    const r = construireDeclaration('100', 'x'.repeat(COMMENTAIRE_REMISE_MAX + 1));
    expect(r).toEqual({ ok: false, erreur: 'Le commentaire ne doit pas dépasser 500 caractères.' });
  });

  it('contestation : motif obligatoire (nettoyé), 500 caractères au plus', () => {
    expect(construireContestation('   ')).toEqual({ ok: false, erreur: MESSAGE_MOTIF_CONTESTATION });
    expect(MESSAGE_MOTIF_CONTESTATION).toBe('Précisez le motif de la contestation.');
    expect(construireContestation(' manque 500 ')).toEqual({ ok: true, valeur: { motif: 'manque 500' } });
    expect(construireContestation('x'.repeat(501))).toEqual({
      ok: false,
      erreur: 'Le motif ne doit pas dépasser 500 caractères.',
    });
  });

  it('actions : seule une remise déclarée s’annule ou se décide', () => {
    for (const s of ['CONFIRMEE', 'CONTESTEE', 'ANNULEE'] as const) {
      expect(peutAnnuler(remise('1', '2026-10-01T10:00:00', s))).toBe(false);
      expect(peutDecider(remise('1', '2026-10-01T10:00:00', s))).toBe(false);
    }
    expect(peutAnnuler(remise('1', '2026-10-01T10:00:00'))).toBe(true);
    expect(peutDecider(remise('1', '2026-10-01T10:00:00'))).toBe(true);
  });

  it('compteur : remises déclarées seulement', () => {
    expect(
      nbRemisesAConfirmer([
        remise('1', '2026-10-01T10:00:00'),
        remise('2', '2026-10-02T10:00:00', 'CONFIRMEE'),
        remise('3', '2026-10-03T10:00:00'),
      ]),
    ).toBe(2);
    expect(nbRemisesAConfirmer(undefined)).toBe(0);
  });

  it('5 dernières remises, de la plus récente à la plus ancienne', () => {
    const liste = ['01', '05', '03', '02', '07', '06', '04'].map((j) => remise(j, `2026-10-${j}T08:00:00`));
    expect(dernieresRemises(liste).map((r) => r.id)).toEqual(['07', '06', '05', '04', '03']);
    expect(dernieresRemises(liste, 2).map((r) => r.id)).toEqual(['07', '06']);
  });
});
