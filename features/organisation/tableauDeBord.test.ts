import {
  LIBELLE_VALEUR_INCOMPLETE,
  jourPrecedent,
  jourSuivant,
  libelleJourTableau,
  nomCommercial,
  peutAvancer,
  valeurIncomplete,
} from './tableauDeBord';

describe('tableau de bord du responsable : règles d’affichage', () => {
  it('libellé du jour : Aujourd’hui, Hier, sinon la date', () => {
    expect(libelleJourTableau('2026-10-13', '2026-10-13')).toBe('Aujourd’hui');
    expect(libelleJourTableau('2026-10-12', '2026-10-13')).toBe('Hier');
    expect(libelleJourTableau('2026-10-01', '2026-10-13')).toBe('01/10/2026');
  });

  it('navigation par jour, jamais après aujourd’hui', () => {
    expect(jourPrecedent('2026-10-01')).toBe('2026-09-30');
    expect(jourSuivant('2026-12-31')).toBe('2027-01-01');
    expect(peutAvancer('2026-10-12', '2026-10-13')).toBe(true);
    expect(peutAvancer('2026-10-13', '2026-10-13')).toBe(false);
  });

  it('valeur incomplète dès qu’un produit n’a pas de prix', () => {
    expect(valeurIncomplete({ produitsSansPrix: 1 })).toBe(true);
    expect(valeurIncomplete({ produitsSansPrix: 0 })).toBe(false);
    expect(LIBELLE_VALEUR_INCOMPLETE).toBe('valeur incomplète');
  });

  it('nom du commercial : prénom puis nom, sans trou', () => {
    expect(nomCommercial({ prenom: 'Ali', nom: 'Kone' })).toBe('Ali Kone');
    expect(nomCommercial({ prenom: null, nom: 'Kone' })).toBe('Kone');
    expect(nomCommercial({ prenom: null, nom: null })).toBe('—');
  });
});
