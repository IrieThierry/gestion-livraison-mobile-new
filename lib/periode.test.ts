import {
  aujourdhui,
  bornesPeriode,
  corrigerIntervalle,
  dansBornes,
  dateDeJour,
  derniersJours,
  jourIso,
  libelleIntervalle,
  moisEnCours,
  type OptionPeriode,
} from './periode';

const NOW = new Date(2026, 9, 12, 15, 30); // 12/10/2026

const OPTIONS: OptionPeriode<'mois' | '30j'>[] = [
  { cle: 'mois', label: 'Ce mois', bornes: moisEnCours },
  { cle: '30j', label: '30 jours', bornes: (n) => derniersJours(30, n) },
];

describe('raccourcis', () => {
  it('jour local, aujourd’hui, mois en cours, n derniers jours', () => {
    expect(jourIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(aujourdhui(NOW)).toEqual({ debut: '2026-10-12', fin: '2026-10-12' });
    expect(moisEnCours(NOW)).toEqual({ debut: '2026-10-01', fin: '2026-10-12' });
    expect(derniersJours(7, NOW)).toEqual({ debut: '2026-10-06', fin: '2026-10-12' });
    expect(derniersJours(30, NOW)).toEqual({ debut: '2026-09-13', fin: '2026-10-12' });
  });

  it('dateDeJour : minuit local, sans décalage', () => {
    const d = dateDeJour('2026-10-01');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 1, 0]);
  });
});

describe('bornesPeriode', () => {
  it('raccourci : ses bornes ; raccourci inconnu : sans bornes', () => {
    expect(bornesPeriode({ cle: 'mois' }, OPTIONS, NOW)).toEqual({ debut: '2026-10-01', fin: '2026-10-12' });
    expect(bornesPeriode({ cle: 'autre' as 'mois' }, OPTIONS, NOW)).toEqual({});
  });

  it('Période… : Du / Au, Au ramené à aujourd’hui, Du jamais après Au', () => {
    expect(bornesPeriode({ du: '2026-10-01', au: '2026-10-05' }, OPTIONS, NOW)).toEqual({
      debut: '2026-10-01',
      fin: '2026-10-05',
    });
    expect(bornesPeriode({ du: '2026-10-01', au: '2026-12-31' }, OPTIONS, NOW)).toEqual({
      debut: '2026-10-01',
      fin: '2026-10-12',
    });
    expect(corrigerIntervalle('2026-10-09', '2026-10-03', NOW)).toEqual({ du: '2026-10-03', au: '2026-10-03' });
    expect(corrigerIntervalle('2026-11-01', '2026-11-05', NOW)).toEqual({ du: '2026-10-12', au: '2026-10-12' });
  });
});

describe('libelleIntervalle', () => {
  it('« 01/10 → 12/10 », année affichée hors année en cours', () => {
    expect(libelleIntervalle('2026-10-01', '2026-10-12', NOW)).toBe('01/10 → 12/10');
    expect(libelleIntervalle('2025-12-20', '2026-01-05', NOW)).toBe('20/12/2025 → 05/01');
  });
});

describe('dansBornes', () => {
  it('jours entiers, bornes incluses', () => {
    const b = { debut: '2026-10-01', fin: '2026-10-05' };
    expect(dansBornes('2026-10-01T00:00:00', b)).toBe(true);
    expect(dansBornes('2026-10-05T23:59:59', b)).toBe(true);
    expect(dansBornes('2026-09-30T23:59:59', b)).toBe(false);
    expect(dansBornes('2026-10-06T00:00:00', b)).toBe(false);
    expect(dansBornes(null, b)).toBe(false);
    expect(dansBornes(null, {})).toBe(true);
    expect(dansBornes('2020-01-01', { fin: '2026-10-05' })).toBe(true);
  });
});
