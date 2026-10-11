import {
  actionApresEnregistrement,
  actionRetourEnTete,
  retourApresEnregistrement,
  type EtatPile,
} from './navigation';

const pile = (...noms: string[]): EtatPile => ({
  index: noms.length - 1,
  routes: noms.map((name) => ({ name })),
});

describe('actionApresEnregistrement', () => {
  it("back quand l'écran précédent est la liste du module", () => {
    expect(actionApresEnregistrement(pile('index', 'nouvelle'))).toBe('back');
  });

  it('liste quand le formulaire est seul dans sa pile (push depuis un autre onglet)', () => {
    expect(actionApresEnregistrement(pile('nouvelle'))).toBe('liste');
  });

  it("liste quand l'écran précédent n'est pas la liste (ex. fiche détail)", () => {
    expect(actionApresEnregistrement(pile('index', '[id]/index', '[id]/modifier'))).toBe('liste');
  });

  it('liste sans état de pile', () => {
    expect(actionApresEnregistrement(undefined)).toBe('liste');
  });

  it("nom d'écran de liste personnalisé", () => {
    // Versement : la liste « Mes versements » est l'écran 'versements/index' de la pile cash.
    expect(actionApresEnregistrement(pile('index', 'versements/index', 'versement'), 'versements/index')).toBe('back');
    expect(actionApresEnregistrement(pile('index', 'versement'), 'versements/index')).toBe('liste');
    expect(actionApresEnregistrement(pile('index', 'retours', 'retour-client'), 'retours')).toBe('back');
    expect(actionApresEnregistrement(pile('index', 'retour-client'), 'retours')).toBe('liste');
  });
});

describe('retourApresEnregistrement', () => {
  const routeur = () => ({ back: jest.fn(), dismissTo: jest.fn(), replace: jest.fn() });

  it('recule simplement quand la liste est juste dessous', () => {
    const r = routeur();
    retourApresEnregistrement(r, '/(livreur)/livraisons', pile('index', 'nouvelle'));
    expect(r.back).toHaveBeenCalledTimes(1);
    expect(r.dismissTo).not.toHaveBeenCalled();
  });

  it('remonte / remplace vers la liste sinon (jamais de formulaire laissé dans la pile)', () => {
    const r = routeur();
    retourApresEnregistrement(r, '/(livreur)/livraisons', pile('nouvelle'));
    expect(r.back).not.toHaveBeenCalled();
    expect(r.dismissTo).toHaveBeenCalledWith('/(livreur)/livraisons');
  });
});

describe('actionRetourEnTete', () => {
  it('back quand la pile du module a un écran précédent', () => {
    expect(
      actionRetourEnTete({ etat: pile('index', 'nouvelle'), retourVers: '/x', peutReculer: true }),
    ).toBe('back');
  });

  it("liste du module quand la pile est vide (jamais le premier onglet)", () => {
    expect(
      actionRetourEnTete({ etat: pile('nouvelle'), retourVers: '/(livreur)/livraisons', peutReculer: true }),
    ).toBe('retourVers');
  });

  it('sans liste connue : comportement historique', () => {
    expect(actionRetourEnTete({ etat: pile('x'), peutReculer: true })).toBe('back');
    expect(actionRetourEnTete({ etat: pile('x'), peutReculer: false })).toBe('fallback');
    expect(actionRetourEnTete({ etat: undefined, peutReculer: false })).toBe('fallback');
  });
});
