import { API_BASE_URL, urlAbsolue } from './api-url';

describe('urlAbsolue', () => {
  it('préfixe un chemin relatif du back (photo utilisateur, client, produit)', () => {
    expect(urlAbsolue('/uploads/utilisateur/u1_1.jpg', 'http://api:8089')).toBe(
      'http://api:8089/uploads/utilisateur/u1_1.jpg',
    );
    expect(urlAbsolue('/uploads/client/c1_1.jpg', 'http://api:8089')).toBe(
      'http://api:8089/uploads/client/c1_1.jpg',
    );
  });

  it('base avec slash final : pas de double slash', () => {
    expect(urlAbsolue('/uploads/utilisateur/u.jpg', 'http://api:8089/')).toBe(
      'http://api:8089/uploads/utilisateur/u.jpg',
    );
    expect(urlAbsolue('/uploads/utilisateur/u.jpg', 'http://api:8089//')).toBe(
      'http://api:8089/uploads/utilisateur/u.jpg',
    );
  });

  it('chemin sans slash initial : slash ajouté', () => {
    expect(urlAbsolue('uploads/utilisateur/u.jpg', 'http://api:8089')).toBe(
      'http://api:8089/uploads/utilisateur/u.jpg',
    );
  });

  it('laisse une URL absolue ou locale telle quelle', () => {
    expect(urlAbsolue('https://cdn.test/u.jpg', 'http://api:8089')).toBe('https://cdn.test/u.jpg');
    expect(urlAbsolue('http://autre:80/u.jpg', 'http://api:8089')).toBe('http://autre:80/u.jpg');
    expect(urlAbsolue('file:///tmp/u.jpg', 'http://api:8089')).toBe('file:///tmp/u.jpg');
  });

  it('vide ou absent : null', () => {
    expect(urlAbsolue(null)).toBeNull();
    expect(urlAbsolue(undefined)).toBeNull();
    expect(urlAbsolue('')).toBeNull();
    expect(urlAbsolue('   ')).toBeNull();
  });

  it('sans base explicite : adresse configurée de l’API', () => {
    expect(urlAbsolue('/uploads/utilisateur/u.jpg')).toBe(
      `${API_BASE_URL.replace(/\/+$/, '')}/uploads/utilisateur/u.jpg`,
    );
  });
});
