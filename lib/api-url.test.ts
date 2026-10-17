import { API_BASE_URL, urlAbsolue, urlPhoto } from './api-url';

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

describe('urlPhoto', () => {
  const base = 'http://api:8089';
  it('chemin relatif : préfixé de l’API', () => {
    expect(urlPhoto('/uploads/a.jpg')).toBe(`${API_BASE_URL.replace(/\/+$/, '')}/uploads/a.jpg`);
    expect(urlPhoto('/uploads/a.jpg', base)).toBe('http://api:8089/uploads/a.jpg');
  });
  it('URL absolue localhost / réseau local : réécrite sur l’API (tunnel https compris)', () => {
    expect(urlPhoto('http://localhost:8089/uploads/a.jpg', base)).toBe('http://api:8089/uploads/a.jpg');
    expect(urlPhoto('http://127.0.0.1:8089/uploads/p/a.jpg?v=2', 'https://x.trycloudflare.com')).toBe(
      'https://x.trycloudflare.com/uploads/p/a.jpg?v=2',
    );
    expect(urlPhoto('http://192.168.1.5:8089/uploads/a.jpg', base)).toBe('http://api:8089/uploads/a.jpg');
  });
  it('URL externe inchangée', () => {
    expect(urlPhoto('https://cdn/x.jpg', base)).toBe('https://cdn/x.jpg');
    expect(urlPhoto('file:///tmp/x.jpg', base)).toBe('file:///tmp/x.jpg');
  });
  it('vide : null', () => {
    expect(urlPhoto(null)).toBeNull();
    expect(urlPhoto(undefined)).toBeNull();
    expect(urlPhoto('  ')).toBeNull();
  });
});
