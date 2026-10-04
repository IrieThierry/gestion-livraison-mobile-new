import { peutFixerRemise } from './regles';

describe('peutFixerRemise (D14)', () => {
  it('admin : oui', () => {
    expect(peutFixerRemise({ profile: 'ADMIN', parentId: null })).toBe(true);
  });

  it('livreur racine (sans parentId) : oui', () => {
    expect(peutFixerRemise({ profile: 'LIVREUR', parentId: null })).toBe(true);
    expect(peutFixerRemise({ profile: 'LIVREUR' })).toBe(true);
  });

  it('apprenti (parentId renseigné) : non', () => {
    expect(peutFixerRemise({ profile: 'LIVREUR', parentId: 'p-1' })).toBe(false);
  });

  it('non connecté : non', () => {
    expect(peutFixerRemise(null)).toBe(false);
  });
});
