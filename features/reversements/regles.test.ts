import {
  totauxReversements,
  bornerAuMoisCourant,
  construireReversement,
  estMoisFutur,
  moisCourant,
  moisParam,
  moisPrecedent,
  moisSuivant,
  montantSuggere,
  periodeDepuisParams,
} from './regles';

const NOW = new Date(2026, 9, 4, 12, 0, 0); // 4 octobre 2026

describe('navigation de mois bornée au mois courant', () => {
  it('mois courant', () => expect(moisCourant(NOW)).toEqual({ annee: 2026, mois: 10 }));
  it('précédent traverse l’année', () => {
    expect(moisPrecedent({ annee: 2026, mois: 1 })).toEqual({ annee: 2025, mois: 12 });
    expect(moisPrecedent({ annee: 2026, mois: 10 })).toEqual({ annee: 2026, mois: 9 });
  });
  it('suivant possible avant le mois courant, traverse l’année', () => {
    expect(moisSuivant({ annee: 2026, mois: 9 }, NOW)).toEqual({ annee: 2026, mois: 10 });
    expect(moisSuivant({ annee: 2025, mois: 12 }, NOW)).toEqual({ annee: 2026, mois: 1 });
  });
  it('pas de suivant au mois courant', () => {
    expect(moisSuivant({ annee: 2026, mois: 10 }, NOW)).toBeNull();
  });
  it('estMoisFutur / bornerAuMoisCourant', () => {
    expect(estMoisFutur({ annee: 2026, mois: 11 }, NOW)).toBe(true);
    expect(estMoisFutur({ annee: 2026, mois: 10 }, NOW)).toBe(false);
    expect(bornerAuMoisCourant({ annee: 2027, mois: 1 }, NOW)).toEqual({ annee: 2026, mois: 10 });
    expect(bornerAuMoisCourant({ annee: 2026, mois: 3 }, NOW)).toEqual({ annee: 2026, mois: 3 });
  });
  it('paramètre YYYY-MM', () => expect(moisParam({ annee: 2026, mois: 4 })).toBe('2026-04'));
});

describe('periodeDepuisParams', () => {
  it('lit mois/année valides', () => {
    expect(periodeDepuisParams('9', '2026', NOW)).toEqual({ annee: 2026, mois: 9 });
  });
  it('absent ou invalide -> mois courant', () => {
    expect(periodeDepuisParams(undefined, undefined, NOW)).toEqual({ annee: 2026, mois: 10 });
    expect(periodeDepuisParams('13', '2026', NOW)).toEqual({ annee: 2026, mois: 10 });
    expect(periodeDepuisParams('abc', '2026', NOW)).toEqual({ annee: 2026, mois: 10 });
  });
  it('mois à venir -> mois courant', () => {
    expect(periodeDepuisParams('12', '2026', NOW)).toEqual({ annee: 2026, mois: 10 });
  });
});

describe('montantSuggere', () => {
  it('reste > 0 -> chaîne décimale', () => {
    expect(montantSuggere(1500.5)).toBe('1500.5');
    expect(montantSuggere('200.00' as unknown as number)).toBe('200');
  });
  it('reste nul ou négatif -> vide', () => {
    expect(montantSuggere(0)).toBe('');
    expect(montantSuggere(-3)).toBe('');
    expect(montantSuggere(null)).toBe('');
  });
});

describe('totauxReversements', () => {
  it('exclut les reversements informatifs de tous les totaux', () => {
    const t = totauxReversements([
      { type: 'FOURNISSEUR', montant: 60, informatif: false },
      { type: 'FOURNISSEUR', montant: 60, informatif: true },
      { type: 'CLIENT', montant: 10 },
    ]);
    expect(t).toEqual({ total: 70, clients: 10, fournisseurs: 60, nombre: 2 });
  });
});

describe('construireReversement', () => {
  const base = {
    type: 'CLIENT' as const,
    beneficiaireId: 'cli-1',
    montant: '1500,75',
    periode: { annee: 2026, mois: 9 },
    dateReversement: '2026-10-04' as string | null,
    aujourdhui: '2026-10-04',
    commentaire: '  remise septembre ',
    now: NOW,
  };

  it('construit la requête (montant décimal, date en début de journée)', () => {
    expect(construireReversement(base)).toEqual({
      ok: true,
      valeur: {
        type: 'CLIENT',
        beneficiaireId: 'cli-1',
        montant: 1500.75,
        mois: 9,
        annee: 2026,
        dateReversement: '2026-10-04T00:00:00',
        commentaire: 'remise septembre',
      },
    });
  });
  it('date absente -> omise (le serveur prend aujourd’hui), commentaire vide omis', () => {
    const r = construireReversement({ ...base, dateReversement: null, commentaire: ' ' });
    expect(r).toEqual({
      ok: true,
      valeur: { type: 'CLIENT', beneficiaireId: 'cli-1', montant: 1500.75, mois: 9, annee: 2026 },
    });
  });
  it('refuse une date future', () => {
    const r = construireReversement({ ...base, dateReversement: '2026-10-05' });
    expect(r).toEqual({ ok: false, erreur: 'La date du reversement ne peut pas être dans le futur.' });
  });
  it('refuse un mois à venir', () => {
    const r = construireReversement({ ...base, periode: { annee: 2026, mois: 11 } });
    expect(r.ok).toBe(false);
  });
  it('refuse un montant nul, invalide ou un bénéficiaire manquant', () => {
    expect(construireReversement({ ...base, montant: '0' }).ok).toBe(false);
    expect(construireReversement({ ...base, montant: 'abc' }).ok).toBe(false);
    expect(construireReversement({ ...base, beneficiaireId: undefined }).ok).toBe(false);
  });
});
