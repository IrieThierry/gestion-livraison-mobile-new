import { MESSAGE_FORMAT_PHOTO, MESSAGE_TAILLE_PHOTO, TAILLE_MAX_PHOTO, verifierPhotoProduit } from './photo';

describe('FM3 : photo de produit (règles du web)', () => {
  it('JPEG ou PNG (fichier envoyé ou nom), 10 Mo au plus', () => {
    expect(verifierPhotoProduit({ uri: 'file:///cache/a.jpg', name: 'IMG_1.HEIC' })).toBeNull();
    expect(verifierPhotoProduit({ name: 'pain.PNG' })).toBeNull();
    expect(verifierPhotoProduit({ uri: 'file:///cache/a.gif', name: 'a.gif' })).toBe(MESSAGE_FORMAT_PHOTO);
    expect(verifierPhotoProduit({ name: 'a.jpeg', fileSize: TAILLE_MAX_PHOTO + 1 })).toBe(MESSAGE_TAILLE_PHOTO);
    expect(verifierPhotoProduit({ name: 'a.jpeg', fileSize: TAILLE_MAX_PHOTO })).toBeNull();
  });
});
