import { actionRacineOnglet, type EtatOnglets } from './onglets';

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
