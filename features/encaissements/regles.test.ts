import type { EncaissementLivraisonResponse, EncoursClientResponse } from '../../types/api';
import {
  avanceEstimee,
  dateEncaissementParam,
  dernierEncaissementDuClient,
  encaisseAujourdhui,
  estDuJour,
  indexerEncours,
  jourLocal,
  libelleSolde,
  numeroReference,
  parseMontant,
  plageEnParams,
  totalAEncaisser,
  totalAvances,
} from './regles';

const enc = (p: Partial<EncaissementLivraisonResponse>): EncaissementLivraisonResponse =>
  ({
    id: 'e',
    reference: 'ENC-LIV1',
    client: { id: 'c-1' },
    dateEncaissement: '2026-10-04T10:00:00',
    montantEncaisse: 0,
    detteAvant: 0,
    detteApres: 0,
    ...p,
  }) as unknown as EncaissementLivraisonResponse;

const encours = (clientId: string, solde: number | string, extra: Partial<EncoursClientResponse> = {}) =>
  ({ clientId, solde, enDepassement: false, ...extra }) as unknown as EncoursClientResponse;

describe('parseMontant (montant décimal, sans plafond)', () => {
  it.each([
    ['1500', 1500],
    ['1500,5', 1500.5],
    ['1 500.25', 1500.25],
    ['0.5', 0.5],
    ['99999999', 99999999],
  ])('accepte %s', (brut, attendu) => {
    expect(parseMontant(brut)).toEqual({ ok: true, valeur: attendu });
  });

  it.each(['', '0', '0,00', '-5', 'abc', '12.345', '1e3'])('refuse %p', (brut) => {
    expect(parseMontant(brut).ok).toBe(false);
  });
});

describe('avanceEstimee', () => {
  it('0 quand le paiement ne dépasse pas le dû', () => {
    expect(avanceEstimee(5000, 3000)).toBe(0);
    expect(avanceEstimee(5000, 5000)).toBe(0);
  });
  it('la part au-delà du dû est une avance', () => {
    expect(avanceEstimee(5000, 7000.5)).toBe(2000.5);
  });
  it('client déjà en avance (solde négatif) : tout le paiement est avance', () => {
    expect(avanceEstimee(-1000, 2000)).toBe(2000);
  });
  it('tolère un BigDecimal sérialisé en chaîne', () => {
    expect(avanceEstimee('1000.00' as unknown as number, 1500)).toBe(500);
  });
});

describe('plage et dates envoyées au back (LocalDateTime)', () => {
  it('étend la date de fin à la fin de journée', () => {
    expect(plageEnParams('2026-09-01', '2026-10-04')).toEqual({
      dateDebut: '2026-09-01T00:00:00',
      dateFin: '2026-10-04T23:59:59',
    });
  });
  it("date d'encaissement : aujourd'hui → laissée au serveur ; autre jour → ce jour", () => {
    expect(dateEncaissementParam('2026-10-04', '2026-10-04')).toBeUndefined();
    expect(dateEncaissementParam(null, '2026-10-04')).toBeUndefined();
    expect(dateEncaissementParam('2026-10-01', '2026-10-04')).toBe('2026-10-01T00:00:00');
  });
  it('jourLocal formate en YYYY-MM-DD local', () => {
    expect(jourLocal(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });
});

describe('encaissé aujourd’hui = Σ montantEncaisse des encaissements du jour', () => {
  const now = new Date(2026, 9, 4, 18, 0);
  it('ne compte que le jour courant, valeurs décimales et chaînes', () => {
    const liste = [
      enc({ dateEncaissement: '2026-10-04T08:00:00', montantEncaisse: 1000.5 }),
      enc({ dateEncaissement: '2026-10-04T17:59:00', montantEncaisse: '250' as unknown as number }),
      enc({ dateEncaissement: '2026-10-03T23:00:00', montantEncaisse: 9999 }),
    ];
    expect(encaisseAujourdhui(liste, now)).toBe(1250.5);
  });
  it('date absente ou invalide → ignorée', () => {
    expect(estDuJour(null, now)).toBe(false);
    expect(estDuJour('pas une date', now)).toBe(false);
  });
});

describe('à encaisser = Σ soldes positifs serveur', () => {
  const liste = [encours('a', 1500), encours('b', -400), encours('c', '250.5'), encours('d', 0)];
  it('ignore avances et soldes nuls', () => {
    expect(totalAEncaisser(liste)).toBe(1750.5);
  });
  it('totalAvances additionne les soldes négatifs', () => {
    expect(totalAvances(liste)).toBe(400);
  });
  it('indexerEncours indexe par client', () => {
    const m = indexerEncours(liste);
    expect(m.get('b')?.solde).toBe(-400);
    expect(indexerEncours(undefined).size).toBe(0);
  });
  it('libelleSolde', () => {
    expect(libelleSolde(10)).toBe('du');
    expect(libelleSolde(-10)).toBe('avance');
    expect(libelleSolde(0)).toBe('a-jour');
  });
});

describe('dernier encaissement d’un client', () => {
  it('prend le plus grand numéro de référence du client (pas l’ordre de liste)', () => {
    const liste = [
      enc({ id: '1', reference: 'ENC-LIV9', client: { id: 'c-1' } as never }),
      enc({ id: '2', reference: 'ENC-LIV10', client: { id: 'c-1' } as never }),
      enc({ id: '3', reference: 'ENC-LIV11', client: { id: 'c-2' } as never }),
    ];
    expect(dernierEncaissementDuClient(liste, 'c-1')?.id).toBe('2');
    expect(dernierEncaissementDuClient(liste, 'c-3')).toBeUndefined();
  });
  it('numeroReference', () => {
    expect(numeroReference('ENC-LIV42')).toBe(42);
    expect(numeroReference(null)).toBe(0);
  });
});
