import { initialeProduit, teinteProduit, TEINTES_VIGNETTE, urlPhotoProduit } from './vignette';
import { urlAbsolue } from '../../lib/api-url';

describe('initialeProduit', () => {
  it('prend la première lettre en majuscule', () => {
    expect(initialeProduit('pain de mie')).toBe('P');
    expect(initialeProduit('  éclair')).toBe('É');
  });

  it('ignore la ponctuation de tête et accepte un chiffre', () => {
    expect(initialeProduit('« Baguette »')).toBe('B');
    expect(initialeProduit('7Up 33 cl')).toBe('7');
  });

  it('sans désignation : « ? »', () => {
    expect(initialeProduit('')).toBe('?');
    expect(initialeProduit(null)).toBe('?');
    expect(initialeProduit(undefined)).toBe('?');
  });
});

describe('teinteProduit', () => {
  it('est stable pour une même désignation (casse et espaces ignorés)', () => {
    expect(teinteProduit('Pain')).toEqual(teinteProduit('  pain '));
  });

  it('appartient à la palette', () => {
    for (const d of ['Pain', 'Lait', 'Sucre', 'Riz', '', null]) {
      expect(TEINTES_VIGNETTE).toContainEqual(teinteProduit(d));
    }
  });
});

describe('urlPhotoProduit / urlAbsolue', () => {
  it('préfixe un chemin relatif du back par l’adresse de l’API', () => {
    expect(urlAbsolue('/uploads/produit/p1_1.jpg', 'http://api:8089/')).toBe(
      'http://api:8089/uploads/produit/p1_1.jpg',
    );
    expect(urlAbsolue('uploads/produit/p1_1.jpg', 'http://api:8089')).toBe(
      'http://api:8089/uploads/produit/p1_1.jpg',
    );
  });

  it('garde une URL absolue telle quelle', () => {
    expect(urlPhotoProduit('https://cdn.test/p.jpg')).toBe('https://cdn.test/p.jpg');
  });

  it('sans photo : null (repli sur l’initiale)', () => {
    expect(urlPhotoProduit(null)).toBeNull();
    expect(urlPhotoProduit(undefined)).toBeNull();
    expect(urlPhotoProduit('  ')).toBeNull();
  });

  it('chemin relatif sans base explicite : préfixé par l’adresse configurée', () => {
    const url = urlPhotoProduit('/uploads/produit/p1_1.jpg');
    expect(url).toMatch(/^https?:\/\/.+\/uploads\/produit\/p1_1\.jpg$/);
  });
});
