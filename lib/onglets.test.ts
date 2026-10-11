import { actionRacineOnglet, listenersRacineOnglet, type EtatOnglets } from './onglets';

/** Navigateur d'onglets : Tournée (écran simple), Moi (pile), Livraisons (pile). */
function onglets(pileMoi?: string[], pileLivraisons?: string[]): EtatOnglets {
  return {
    routes: [
      { key: 'index-k', name: 'index' },
      {
        key: 'profil-k',
        name: 'profil',
        state: pileMoi ? { key: 'pile-moi', index: pileMoi.length - 1, routes: pileMoi.map((name) => ({ name })) } : undefined,
      },
      {
        key: 'livraisons-k',
        name: 'livraisons',
        state: pileLivraisons
          ? { key: 'pile-liv', index: pileLivraisons.length - 1, routes: pileLivraisons.map((name) => ({ name })) }
          : undefined,
      },
    ],
  };
}

describe('actionRacineOnglet', () => {
  it('Accueil → avatar → Mes infos, puis Accueil, puis onglet Moi : retour au menu Moi', () => {
    // Pile Moi = [index, infos] alors que l'onglet actif est la Tournée.
    expect(actionRacineOnglet(onglets(['index', 'infos']), 'profil-k')).toEqual({
      type: 'POP_TO_TOP',
      target: 'pile-moi',
    });
  });

  it('sous-route ouverte seule dans la pile (sans la racine dessous) : la pile repart de la racine', () => {
    expect(actionRacineOnglet(onglets(['infos']), 'profil-k')).toEqual({
      type: 'RESET',
      target: 'pile-moi',
      payload: { index: 0, routes: [{ name: 'index' }] },
    });
  });

  it('onglet déjà actif avec sous-routes : même règle (retour à la racine)', () => {
    expect(actionRacineOnglet(onglets(undefined, ['index', '[id]', 'nouvelle']), 'livraisons-k')).toEqual({
      type: 'POP_TO_TOP',
      target: 'pile-liv',
    });
  });

  it('rien à faire : déjà sur la racine, pile pas encore montée, écran sans pile, onglet inconnu', () => {
    expect(actionRacineOnglet(onglets(['index']), 'profil-k')).toBeNull();
    expect(actionRacineOnglet(onglets(), 'profil-k')).toBeNull();
    expect(actionRacineOnglet(onglets(['index', 'infos']), 'index-k')).toBeNull();
    expect(actionRacineOnglet(onglets(['index', 'infos']), 'inconnu')).toBeNull();
    expect(actionRacineOnglet(undefined, 'profil-k')).toBeNull();
  });

  it("n'agit que sur l'onglet appuyé", () => {
    expect(actionRacineOnglet(onglets(['index', 'infos'], ['index']), 'livraisons-k')).toBeNull();
  });
});

describe('listenersRacineOnglet (tabPress)', () => {
  const appui = (etat: EtatOnglets, routeKey: string, actif: boolean) => {
    const navigation = { getState: () => etat, isFocused: () => actif, dispatch: jest.fn() };
    const e = { preventDefault: jest.fn() };
    listenersRacineOnglet()({ navigation, route: { key: routeKey } }).tabPress(e);
    return { dispatch: navigation.dispatch, preventDefault: e.preventDefault };
  };

  it('onglet inactif avec sous-routes : pile vidée, onglet affiché par défaut', () => {
    const { dispatch, preventDefault } = appui(onglets(['index', 'infos']), 'profil-k', false);
    expect(dispatch).toHaveBeenCalledWith({ type: 'POP_TO_TOP', target: 'pile-moi' });
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('onglet actif avec sous-routes : pile vidée sans re-navigation', () => {
    const { dispatch, preventDefault } = appui(onglets(['index', 'infos']), 'profil-k', true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('pile déjà sur la racine : ni dispatch ni preventDefault', () => {
    for (const actif of [true, false]) {
      const { dispatch, preventDefault } = appui(onglets(['index']), 'profil-k', actif);
      expect(dispatch).not.toHaveBeenCalled();
      expect(preventDefault).not.toHaveBeenCalled();
    }
  });
});
