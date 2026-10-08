import type { EncaissementLivraisonResponse, EncoursClientResponse } from '../../types/api';
import {
  basculerSelection,
  dateEncaissementParam,
  libelleEcart,
  peutValiderEncaissement,
  tonEcart,
  totalResteDuSelection,
  totalRemiseNette,
  encaisseAujourdhui,
  estDuJour,
  indexerEncours,
  jourLocal,
  libelleSolde,
  parseMontant,
  totalAEncaisser,
  totalAvances,
  totalMontantDu,
  prixUnitaireClient,
} from './regles';

describe('totalMontantDu (Σ dû net serveur, jamais le brut montantLivre)', () => {
  it('somme montantDu, ignore montantLivre, tolère chaînes et null', () => {
    expect(
      totalMontantDu([
        { montantDu: 2500, montantLivre: 3000 } as { montantDu: number },
        { montantDu: '520.50' as unknown as number },
        { montantDu: null },
      ]),
    ).toBe(3020.5);
    expect(totalMontantDu([])).toBe(0);
  });
});

describe('prixUnitaireClient', () => {
  it('prix de vente + remise unitaire', () => {
    expect(prixUnitaireClient({ prixDeVente: 200, remiseUnitaire: 50 })).toBe(250);
    expect(prixUnitaireClient({ prixDeVente: 200, remiseUnitaire: null })).toBe(200);
  });
});

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

describe('dates envoyées au back (LocalDateTime)', () => {
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

describe('libelleEcart (mêmes libellés que le web)', () => {
  const espaces = (s: string) => s.replace(/\s/g, ' ');
  it('−500 → Reste dû 500', () => {
    expect(libelleEcart(-500)).toBe('Reste dû 500');
  });
  it('0 → Aucun écart', () => {
    expect(libelleEcart(0)).toBe('Aucun écart');
  });
  it('350 → Surplus 350 → avance', () => {
    expect(libelleEcart(350)).toBe('Surplus 350 → avance');
  });
  it('milliers et BigDecimal en chaîne', () => {
    expect(espaces(libelleEcart(-2150))).toBe('Reste dû 2 150');
    expect(libelleEcart('-500.00' as unknown as number)).toBe('Reste dû 500');
  });
  it('tonEcart', () => {
    expect(tonEcart(-1)).toBe('negatif');
    expect(tonEcart(0)).toBe('nul');
    expect(tonEcart(1)).toBe('positif');
  });
});

describe('peutValiderEncaissement', () => {
  it('faux sans livraison cochée', () => {
    expect(peutValiderEncaissement([], 100)).toBe(false);
  });
  it('faux avec un montant ≤ 0', () => {
    expect(peutValiderEncaissement(['l-1'], 0)).toBe(false);
    expect(peutValiderEncaissement(['l-1'], -5)).toBe(false);
    expect(peutValiderEncaissement(['l-1'], Number.NaN)).toBe(false);
  });
  it('vrai avec au moins une livraison et un montant > 0', () => {
    expect(peutValiderEncaissement(['l-1'], 100)).toBe(true);
  });
});

describe('basculerSelection', () => {
  it('ajoute une livraison absente', () => {
    expect(basculerSelection(['l-1'], 'l-2')).toEqual(['l-1', 'l-2']);
  });
  it('retire une livraison présente', () => {
    expect(basculerSelection(['l-1', 'l-2'], 'l-1')).toEqual(['l-2']);
  });
  it('ne modifie pas le tableau reçu', () => {
    const ids = ['l-1'];
    basculerSelection(ids, 'l-2');
    expect(ids).toEqual(['l-1']);
  });
});

describe('totalResteDuSelection', () => {
  it('somme les restes dus serveur des seules livraisons cochées', () => {
    const livs = [
      { id: 'l-1', resteDu: 1750 },
      { id: 'l-2', resteDu: '1400' as unknown as number },
      { id: 'l-3', resteDu: 999 },
    ];
    expect(totalResteDuSelection(livs, ['l-1', 'l-2'])).toBe(3150);
    expect(totalResteDuSelection(livs, [])).toBe(0);
  });
});

describe('totalRemiseNette (remise du jour)', () => {
  it('somme les remises nettes serveur, null/chaîne tolérés', () => {
    expect(
      totalRemiseNette([
        { remiseNette: 100.5 },
        { remiseNette: null },
        { remiseNette: '50' as unknown as number },
      ]),
    ).toBe(150.5);
    expect(totalRemiseNette([])).toBe(0);
  });
});
