import { estEquilibre, parseMontantRemis } from './regles';

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
  it('accepte la virgule', () => expect(parseMontantRemis('12500,5')).toBe(12500.5));
  it('accepte le point', () => expect(parseMontantRemis('12500.5')).toBe(12500.5));
  it('accepte un entier', () => expect(parseMontantRemis('12500')).toBe(12500));
  it('vide ou espaces -> 0', () => {
    expect(parseMontantRemis('')).toBe(0);
    expect(parseMontantRemis(' ')).toBe(0);
  });
  it('invalide -> 0', () => expect(parseMontantRemis('abc')).toBe(0));
});
