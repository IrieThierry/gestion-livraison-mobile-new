import { libelleDestination, libelleOrigine, libelleQuantite, libelleValeur } from './libelles';

describe('libellés des retours (alignés sur le web)', () => {
  it('origine', () => {
    expect(libelleOrigine('MENU_RETOURS')).toBe('Menu Retours');
    expect(libelleOrigine('MODIFICATION_LIVRAISON')).toBe('Modification de la livraison');
    expect(libelleOrigine('CREATION_LIVRAISON')).toBe('Création de la livraison');
  });

  it('quantité : +n, ou Correction −n', () => {
    expect(libelleQuantite(3)).toBe('+3');
    expect(libelleQuantite(-2)).toBe('Correction −2');
  });

  it('destination', () => {
    expect(libelleDestination(true)).toBe('Remis en stock');
    expect(libelleDestination(false)).toBe('Perdu');
  });

  it('valeur : signe du back, tiret si absente', () => {
    expect(libelleValeur(null)).toBe('—');
    expect(libelleValeur(300)).toMatch(/^300$/);
    expect(libelleValeur(-100)).toMatch(/^−100$/);
  });
});
