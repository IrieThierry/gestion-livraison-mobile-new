import {
  MESSAGE_FORMAT_PHOTO,
  MESSAGE_TAILLE_PHOTO,
  TAILLE_MAX_PHOTO,
  lirePhotoProduit,
  verifierPhotoProduit,
} from './photo';

describe('FM3 : photo de produit (règles du web)', () => {
  it('type réel d’abord (mimeType) : seul JPEG ou PNG passe, et le nom envoyé en prend l’extension', () => {
    // iOS : fichier réencodé en JPEG, nom d'origine en .PNG ou .GIF.
    expect(lirePhotoProduit({ uri: 'file:///c/x.jpg', name: 'IMG_1.PNG', mimeType: 'image/jpeg' })).toEqual({
      ok: true,
      name: 'IMG_1.jpg',
    });
    expect(lirePhotoProduit({ uri: 'file:///c/x.jpg', name: 'anim.GIF', mimeType: 'image/jpeg' })).toEqual({
      ok: true,
      name: 'anim.jpg',
    });
    expect(lirePhotoProduit({ uri: 'file:///c/x.png', name: 'x.png', mimeType: 'image/png' })).toEqual({
      ok: true,
      name: 'x.png',
    });
    expect(lirePhotoProduit({ uri: 'file:///c/x.jpg', name: 'x.jpg', mimeType: 'image/gif' })).toEqual({
      ok: false,
      erreur: MESSAGE_FORMAT_PHOTO,
    });
    expect(lirePhotoProduit({ uri: 'file:///c/x.heic', name: 'x.heic', mimeType: 'image/heic' })).toEqual({
      ok: false,
      erreur: MESSAGE_FORMAT_PHOTO,
    });
  });

  it('sans mimeType : extension du fichier envoyé (uri), puis du nom', () => {
    expect(lirePhotoProduit({ uri: 'file:///cache/a.jpg', name: 'IMG_1.HEIC' })).toEqual({ ok: true, name: 'IMG_1.jpg' });
    expect(lirePhotoProduit({ name: 'pain.PNG' })).toEqual({ ok: true, name: 'pain.png' });
    expect(verifierPhotoProduit({ uri: 'file:///cache/a.gif', name: 'a.gif' })).toBe(MESSAGE_FORMAT_PHOTO);
  });

  it('10 Mo au plus, quand la taille est connue', () => {
    expect(verifierPhotoProduit({ name: 'a.jpeg', fileSize: TAILLE_MAX_PHOTO + 1 })).toBe(MESSAGE_TAILLE_PHOTO);
    expect(verifierPhotoProduit({ name: 'a.jpeg', fileSize: TAILLE_MAX_PHOTO })).toBeNull();
  });
});
