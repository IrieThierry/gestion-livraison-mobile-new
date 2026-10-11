import { dispositionBoutons, ordreBoutons } from './dialog-layout';

describe('dispositionBoutons', () => {
  it('un seul bouton : ligne', () => {
    expect(dispositionBoutons(['OK'])).toBe('ligne');
    expect(dispositionBoutons([])).toBe('ligne');
  });

  it('deux libellés courts : côte à côte', () => {
    expect(dispositionBoutons(['Annuler', 'Confirmer'])).toBe('ligne');
  });

  it('un libellé long : empilés', () => {
    expect(dispositionBoutons(['Annuler', 'Réceptionner quand même'])).toBe('colonne');
  });

  it('deux libellés moyens dont le cumul dépasse la demi-largeur : empilés', () => {
    expect(dispositionBoutons(['Garder le reliquat', 'Clore'])).toBe('colonne');
    expect(dispositionBoutons(['Retour stock', 'Marquer perdu'])).toBe('colonne');
  });

  it('plus de deux boutons : empilés', () => {
    expect(dispositionBoutons(['A', 'B', 'C'])).toBe('colonne');
  });
});

describe('ordreBoutons', () => {
  it("en ligne : ordre fourni (annuler à gauche)", () => {
    expect(ordreBoutons(['secondary', 'primary'], 'ligne')).toEqual([0, 1]);
  });

  it('en colonne : bouton principal en premier', () => {
    expect(ordreBoutons(['secondary', 'primary'], 'colonne')).toEqual([1, 0]);
    expect(ordreBoutons(['secondary', 'destructive'], 'colonne')).toEqual([1, 0]);
    expect(ordreBoutons([undefined, 'secondary'], 'colonne')).toEqual([0, 1]);
  });
});
