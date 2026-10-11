import {
  AUCUN_RESULTAT,
  correspondRecherche,
  filtrerRecherche,
  normaliserRecherche,
} from './recherche';

describe('normaliserRecherche', () => {
  it('minuscules, sans accents, espaces normalisés', () => {
    expect(normaliserRecherche('  Éléphant   Côte  ')).toBe('elephant cote');
    expect(normaliserRecherche(null)).toBe('');
    expect(normaliserRecherche(undefined)).toBe('');
    expect(normaliserRecherche(42)).toBe('42');
  });
});

describe('correspondRecherche', () => {
  it('requête vide → vrai', () => {
    expect(correspondRecherche('', ['a'])).toBe(true);
    expect(correspondRecherche('   ', [])).toBe(true);
  });

  it('insensible à la casse et aux accents', () => {
    expect(correspondRecherche('KOUASSI', ['Kouassi'])).toBe(true);
    expect(correspondRecherche('cocody', ['Cocody Angré'])).toBe(true);
    expect(correspondRecherche('angre', ['Cocody Angré'])).toBe(true);
    expect(correspondRecherche('ANGRÉ', ['cocody angre'])).toBe(true);
  });

  it('multi-mots : chaque mot dans un champ quelconque', () => {
    expect(correspondRecherche('awa cocody', ['Awa', 'Koné', 'Cocody'])).toBe(true);
    expect(correspondRecherche('awa yopougon', ['Awa', 'Koné', 'Cocody'])).toBe(false);
  });

  it('ignore les champs vides et accepte les nombres', () => {
    expect(correspondRecherche('0707', [null, undefined, '', '07 07 12 34'.replace(/ /g, '')])).toBe(true);
    expect(correspondRecherche('12', [1234])).toBe(true);
  });
});

describe('filtrerRecherche', () => {
  const items = [
    { nom: 'Bamba', quartier: 'Yopougon' },
    { nom: 'Éric', quartier: 'Cocody' },
    { nom: 'Zadi', quartier: 'Cocody' },
  ];

  it('conserve l’ordre et filtre', () => {
    expect(filtrerRecherche(items, 'cocody', (i) => [i.nom, i.quartier]).map((i) => i.nom)).toEqual([
      'Éric',
      'Zadi',
    ]);
    expect(filtrerRecherche(items, 'eric', (i) => [i.nom]).map((i) => i.nom)).toEqual(['Éric']);
  });

  it('requête vide → copie de la liste', () => {
    const r = filtrerRecherche(items, '', (i) => [i.nom]);
    expect(r).toEqual(items);
    expect(r).not.toBe(items);
  });

  it('aucun résultat', () => {
    expect(filtrerRecherche(items, 'abobo', (i) => [i.nom, i.quartier])).toEqual([]);
    expect(AUCUN_RESULTAT).toBe('Aucun résultat');
  });
});
