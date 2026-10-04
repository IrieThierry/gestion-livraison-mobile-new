import {
  construireCloture,
  ecartCaisse,
  estEquilibre,
  libelleEcart,
  messageClotureEnregistree,
  parseMontantRemis,
  sensEcart,
  totauxEstimesDuJour,
} from './regles';
import type { ClotureJournaliereResponse } from '../../types/api';

describe('estEquilibre', () => {
  it('accepte zéro', () => expect(estEquilibre(0)).toBe(true));
  it('arrondit les centimes à zéro', () => {
    expect(estEquilibre(0.4)).toBe(true);
    expect(estEquilibre(-0.4)).toBe(true);
  });
  it('refuse un écart affiché non nul', () => {
    expect(estEquilibre(0.6)).toBe(false);
    expect(estEquilibre(-0.6)).toBe(false);
    expect(estEquilibre(-500)).toBe(false);
    expect(estEquilibre(1000)).toBe(false);
  });
});

describe('parseMontantRemis', () => {
  it('accepte la virgule et le point', () => {
    expect(parseMontantRemis('12500,5')).toEqual({ ok: true, valeur: 12500.5 });
    expect(parseMontantRemis('12500.5')).toEqual({ ok: true, valeur: 12500.5 });
  });
  it('accepte un entier et zéro (rien remis)', () => {
    expect(parseMontantRemis('12500')).toEqual({ ok: true, valeur: 12500 });
    expect(parseMontantRemis('0')).toEqual({ ok: true, valeur: 0 });
  });
  it('vide -> erreur (saisie obligatoire)', () => {
    expect(parseMontantRemis('').ok).toBe(false);
    expect(parseMontantRemis('  ').ok).toBe(false);
  });
  it('invalide, négatif ou 3 décimales -> erreur', () => {
    expect(parseMontantRemis('abc').ok).toBe(false);
    expect(parseMontantRemis('-5').ok).toBe(false);
    expect(parseMontantRemis('1,234').ok).toBe(false);
  });
});

describe('écart (signe du back : encaissé − remis)', () => {
  it('remis < encaissé -> positif = manque en caisse', () => {
    expect(ecartCaisse(10000, 9000)).toBe(1000);
    expect(sensEcart(1000)).toBe('manque');
    expect(libelleEcart(500)).toBe('Manque en caisse : 500 FCFA');
  });
  it('remis > encaissé -> négatif = excédent remis', () => {
    expect(ecartCaisse(9000, 9500.5)).toBe(-500.5);
    expect(sensEcart(-500.5)).toBe('excedent');
    expect(libelleEcart(-500.5)).toBe('Excédent remis : 500,5 FCFA');
  });
  it('égal -> équilibré', () => {
    expect(ecartCaisse(9000, 9000)).toBe(0);
    expect(sensEcart(0.3)).toBe('equilibre');
    expect(libelleEcart(0)).toBe('Caisse équilibrée');
  });
  it('arrondit au centime', () => {
    expect(ecartCaisse(0.3, 0.1)).toBe(0.2);
  });
});

describe('totauxEstimesDuJour', () => {
  const livraisons = [
    { date: '2026-10-04T08:00:00', montantDu: 1500 },
    { date: '2026-10-04T18:30:00', montantDu: 250.5 },
    { date: '2026-10-03T23:59:00', montantDu: 9999 },
  ];
  const encaissements = [
    { dateEncaissement: '2026-10-04T09:00:00', montantEncaisse: 1000 },
    { dateEncaissement: '2026-10-04T10:00:00', montantEncaisse: '200.25' as unknown as number },
    { dateEncaissement: '2026-10-05T00:00:00', montantEncaisse: 7777 },
  ];

  it('Σ montantDu des livraisons du jour et Σ montantEncaisse par dateEncaissement', () => {
    expect(totauxEstimesDuJour('2026-10-04', livraisons, encaissements)).toEqual({
      totalDu: 1750.5,
      totalEncaisse: 1200.25,
    });
  });
  it('jour sans activité -> 0', () => {
    expect(totauxEstimesDuJour('2026-09-01', livraisons, encaissements)).toEqual({
      totalDu: 0,
      totalEncaisse: 0,
    });
  });
});

describe('construireCloture', () => {
  const base = { livreurId: 'liv-1', dateCloture: '2026-10-04', montantRemis: '1200,25', commentaire: '  ok  ' };

  it('construit la requête (début de journée, montant décimal, commentaire nettoyé)', () => {
    expect(construireCloture(base)).toEqual({
      ok: true,
      valeur: {
        livreurId: 'liv-1',
        dateCloture: '2026-10-04T00:00:00',
        montantRemis: 1200.25,
        commentaire: 'ok',
      },
    });
  });
  it('omet un commentaire vide', () => {
    const r = construireCloture({ ...base, commentaire: '   ' });
    expect(r.ok && 'commentaire' in r.valeur).toBe(false);
  });
  it('refuse une date absente ou un montant invalide', () => {
    expect(construireCloture({ ...base, dateCloture: null }).ok).toBe(false);
    expect(construireCloture({ ...base, montantRemis: '' }).ok).toBe(false);
  });
});

describe('messageClotureEnregistree', () => {
  it('affiche les valeurs retournées par le serveur', () => {
    const c = {
      id: 'c1',
      livreur: null,
      dateCloture: '2026-10-04T00:00:00',
      totalLivre: 900,
      totalEncaisse: 800,
      montantRemis: 700.5,
      ecartEspeces: 99.5,
      commentaire: '',
      dateEnregistrement: '2026-10-04T20:00:00',
    } as ClotureJournaliereResponse;
    expect(messageClotureEnregistree(c)).toBe(
      [
        'Total livré (dû) : 900 FCFA',
        'Total encaissé : 800 FCFA',
        'Montant remis : 700,5 FCFA',
        'Manque en caisse : 99,5 FCFA',
      ].join('\n'),
    );
  });
});
