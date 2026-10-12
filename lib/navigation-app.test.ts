import { router } from 'expo-router';
import {
  brancherNavigation,
  naviguer,
  ouvrir,
  retourParent,
  revenirA,
  revenirApresEnregistrement,
  origineDe,
  type RefNavigation,
} from './navigation-app';
import type { EtatNavigateur, RouteEtat } from './navigation';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => false) },
  usePathname: () => '/',
}));
let mockUser: { id: string; parentId: string | null } = { id: 'p', parentId: null };
jest.mock('../stores/authStore', () => ({
  useAuthStore: { getState: () => ({ user: mockUser }) },
}));

const NOMS = ['index', 'clients', 'fab', 'livraisons', 'profil', 'cash', 'stock', 'previsions', 'clotures'];

/**
 * Navigateur factice : applique les RESET / JUMP_TO au navigateur d'onglets
 * comme React Navigation (pile partielle réhydratée avec des clés).
 */
function navigateur(actif = 'index', piles: Record<string, RouteEtat[]> = {}) {
  let n = 0;
  const cles = (r: RouteEtat): RouteEtat => ({
    ...r,
    key: r.key ?? `${r.name}-${++n}`,
    ...(r.state
      ? {
          state: {
            key: (r.state as { key?: string }).key ?? `pile-${++n}`,
            index: r.state.index ?? r.state.routes.length - 1,
            routes: r.state.routes.map(cles),
          },
        }
      : {}),
  });
  let tabs: EtatNavigateur = {
    key: 'tabs',
    index: NOMS.indexOf(actif),
    routeNames: NOMS,
    routes: NOMS.map((name) =>
      cles({ key: `${name}-k`, name, ...(piles[name] ? { state: { index: piles[name].length - 1, routes: piles[name] } } : {}) }),
    ),
  };
  const ref: RefNavigation & { onglets: () => EtatNavigateur } = {
    isReady: () => true,
    getRootState: () => ({ key: 'root', index: 0, routes: [{ name: '(livreur)', state: tabs }] }),
    dispatch: jest.fn((a) => {
      if (a.type === 'JUMP_TO') tabs = { ...tabs, index: NOMS.indexOf(a.payload.name) };
      else tabs = { ...a.payload, routes: a.payload.routes.map(cles) } as EtatNavigateur;
    }),
    onglets: () => tabs,
  };
  brancherNavigation(ref);
  return ref;
}

/** Écran affiché (chemin des noms de route) et pile de l'onglet actif. */
function affiche(ref: ReturnType<typeof navigateur>) {
  const t = ref.onglets();
  const onglet = t.routes[t.index];
  const pile = (onglet.state?.routes ?? []).map((r) =>
    r.state ? `${r.name}>${r.state.routes.map((x) => x.name).join(',')}` : r.name,
  );
  return { onglet: onglet.name, pile };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'p', parentId: null };
  brancherNavigation(null);
});

describe('parcours de navigation (règle du parent logique)', () => {
  it('menu + → Commandes, onglet Accueil, menu + → Retours produits, Accueil → À encaisser → Encours, retour → Accueil', () => {
    const ref = navigateur('index');
    ouvrir('/(livreur)/cash/commandes');
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['commandes>index'] });
    naviguer('/(livreur)/cash/commandes/[id]', { id: '7' }); // même rubrique : empilé (routeur)
    expect(router.push).toHaveBeenCalledWith('/cash/commandes/7');

    ouvrir('/(livreur)'); // onglet Accueil
    expect(affiche(ref).onglet).toBe('index');
    ouvrir('/(livreur)/cash/retours');
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['retours'] }); // pas de Commandes dessous

    ouvrir('/(livreur)'); // Accueil
    ouvrir('/(livreur)/cash/encours'); // tuile « À encaisser »
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['encours'] });
    expect(retourParent()).toBe(true);
    expect(affiche(ref).onglet).toBe('index'); // directement l'Accueil
    expect(retourParent()).toBe(false); // Accueil : le système quitte l'application
  });

  it('formulaire → sa liste ; liste → Accueil', () => {
    const ref = navigateur('index');
    ouvrir('/(livreur)/cash/depenses/nouvelle');
    expect(affiche(ref).pile).toEqual(['depenses>index,nouvelle']);
    retourParent();
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['depenses>index'] });
    retourParent();
    expect(affiche(ref).onglet).toBe('index');
  });

  it('Encaisser depuis la liste des clients (sans origine) → [Mes encaissements, Encaisser] ; après enregistrement : la liste', () => {
    const ref = navigateur('clients', { clients: [{ name: 'index' }] });
    naviguer('/(livreur)/cash/encaisser', { clientId: 'c1' });
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['encaissements', 'encaisser'] });
    revenirApresEnregistrement('/(livreur)/cash/encaissements');
    expect(affiche(ref)).toEqual({ onglet: 'cash', pile: ['encaissements'] });
  });

  it.each([
    ['/(livreur)/cash/encaisser', 'encaisser'],
    ['/(livreur)/livraisons/nouvelle', 'nouvelle'],
    ['/(livreur)/cash/retour-client', 'retour-client'],
  ])('%s depuis la fiche client : retour (flèche ou Android) et enregistrement → la fiche', (href, ecran) => {
    const fiche = { name: '[id]/index', params: { id: 'c1' } };
    const ref = navigateur('clients', { clients: [{ name: 'index' }, fiche] });
    const cleFiche = affiche(ref) && ref.onglets().routes[1].state!.routes[1].key;
    naviguer(href, { clientId: 'c1', depuis: 'client' });
    expect(affiche(ref).pile).toEqual([ecran]);
    expect(retourParent()).toBe(true);
    expect(affiche(ref)).toEqual({ onglet: 'clients', pile: ['index', '[id]/index'] });
    expect(ref.onglets().routes[1].state!.routes[1].key).toBe(cleFiche); // fiche conservée
    naviguer(href, { clientId: 'c1', depuis: 'client' });
    // Origine capturée au montage du formulaire (useRetourListe).
    const origine = origineDe(href, { clientId: 'c1', depuis: 'client' });
    expect(origine).toBe('/clients/c1');
    revenirApresEnregistrement('/(livreur)/cash/encaissements', origine);
    expect(affiche(ref)).toEqual({ onglet: 'clients', pile: ['index', '[id]/index'] });
    // La fiche garde la liste des clients pour parent, puis l'Accueil.
    retourParent();
    expect(affiche(ref)).toEqual({ onglet: 'clients', pile: ['index'] });
    retourParent();
    expect(affiche(ref).onglet).toBe('index');
  });

  it('Modifier depuis la fiche : retour et enregistrement → la fiche', () => {
    const ref = navigateur('clients', { clients: [{ name: 'index' }, { name: '[id]/index', params: { id: 'c1' } }] });
    naviguer('/(livreur)/clients/[id]/modifier', { id: 'c1' });
    expect(router.push).toHaveBeenCalledWith('/clients/c1/modifier');
    const avecModifier = navigateur('clients', {
      clients: [{ name: 'index' }, { name: '[id]/index', params: { id: 'c1' } }, { name: '[id]/modifier', params: { id: 'c1' } }],
    });
    retourParent();
    expect(affiche(avecModifier).pile).toEqual(['index', '[id]/index']);
    void ref;
  });

  it('Encours → Encaisser (depuis encours) : retour → Encours', () => {
    const ref = navigateur('index');
    ouvrir('/(livreur)/cash/encours');
    naviguer('/(livreur)/cash/encaisser', { clientId: 'c1', depuis: 'encours' });
    expect(router.push).toHaveBeenCalledWith({ pathname: '/cash/encaisser', params: { clientId: 'c1', depuis: 'encours' } });
    const pile = navigateur('cash', { cash: [{ name: 'encours' }, { name: 'encaisser', params: { clientId: 'c1', depuis: 'encours' } }] });
    retourParent();
    expect(affiche(pile)).toEqual({ onglet: 'cash', pile: ['encours'] });
    void ref;
  });

  it('apprenti : fiche commande → commandes à réceptionner', () => {
    mockUser = { id: 'a', parentId: 'p' };
    const ref = navigateur('index');
    ouvrir('/(livreur)/cash/commandes/[id]', { id: '3' });
    expect(affiche(ref).pile).toEqual(['commandes>a-receptionner,[id]']);
    retourParent();
    expect(affiche(ref).pile).toEqual(['commandes>a-receptionner']);
  });

  it('lien vers un écran déjà dans la pile : dépilé, pas de doublon', () => {
    const ref = navigateur('cash', { cash: [{ name: 'retours' }, { name: 'retour-client' }] });
    naviguer('/(livreur)/cash/retours');
    expect(affiche(ref).pile).toEqual(['retours']);
    expect(router.push).not.toHaveBeenCalled();
  });
});

describe('écran déjà affiché', () => {
  it('menu + vers la liste affichée : aucune action, aucun repli routeur', () => {
    const ref = navigateur('cash', { cash: [{ name: 'encaissements' }] });
    ouvrir('/(livreur)/cash/encaissements');
    expect(ref.dispatch).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe('sans navigateur branché (repli sur le routeur)', () => {
  it('ouvrir / naviguer / revenirA / retourParent', () => {
    ouvrir('/(livreur)/stock');
    expect(router.navigate).toHaveBeenCalledWith('/stock');
    naviguer('/(livreur)/clients/[id]', { id: 'a' });
    expect(router.push).toHaveBeenCalledWith('/clients/a');
    revenirA('/(livreur)/clients');
    expect(router.dismissTo).toHaveBeenCalledWith('/clients');
    revenirA('/');
    expect(router.navigate).toHaveBeenCalledWith('/(livreur)');
    expect(retourParent('/cash/depenses/nouvelle')).toBe(true);
    expect(router.dismissTo).toHaveBeenLastCalledWith('/cash/depenses');
    expect(retourParent('/')).toBe(false);
  });
});
