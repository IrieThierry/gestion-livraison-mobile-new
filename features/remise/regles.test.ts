import { peutFixerConditions } from './regles';

describe('peutFixerConditions (D14/D20)', () => {
  it('admin : oui', () => {
    expect(peutFixerConditions({ profile: 'ADMIN', parentId: null })).toBe(true);
  });

  it('livreur racine (sans parentId) : oui', () => {
    expect(peutFixerConditions({ profile: 'LIVREUR', parentId: null })).toBe(true);
    expect(peutFixerConditions({ profile: 'LIVREUR' })).toBe(true);
  });

  it('apprenti (parentId renseigné) : non', () => {
    expect(peutFixerConditions({ profile: 'LIVREUR', parentId: 'p-1' })).toBe(false);
  });

  it('non connecté : non', () => {
    expect(peutFixerConditions(null)).toBe(false);
  });
});
