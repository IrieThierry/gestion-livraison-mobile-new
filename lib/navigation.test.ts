import * as fs from 'fs';
import * as path from 'path';
import {
  ACCUEIL,
  actionNaviguer,
  actionOuvrir,
  actionRetour,
  actionRevenirA,
  chaineOuverture,
  ecranActif,
  normaliserHref,
  DEPUIS_A_RECEPTIONNER,
  DEPUIS_CLIENT,
  DEPUIS_ENCOURS,
  DEPUIS_PREVISIONS,
  parentDe,
  parentOrigine,
  pileDe,
  ROUTES,
  trouverOnglets,
  trouverRoute,
  type EtatNavigateur,
  type RouteEtat,
} from './navigation';

const PRINCIPAL = { apprenti: false };
const APPRENTI = { apprenti: true };

/** Fichiers d'écran de app/(livreur) (hors _layout), sans extension. */
function ecrans(): string[] {
  const racine = path.join(__dirname, '..', 'app', '(livreur)');
  const out: string[] = [];
  const parcourir = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) parcourir(p);
      else if (/\.tsx$/.test(e.name) && e.name !== '_layout.tsx')
        out.push(path.relative(racine, p).replace(/\\/g, '/').replace(/\.tsx$/, ''));
    }
  };
  parcourir(racine);
  return out.sort();
}

/** État d'onglets factice : `actif` affiché, piles fournies. */
function onglets(actif: string, piles: Record<string, RouteEtat[]> = {}): EtatNavigateur {
  const noms = ['index', 'clients', 'fab', 'livraisons', 'profil', 'cash', 'stock', 'previsions', 'clotures'];
  return {
    key: 'tabs',
    index: noms.indexOf(actif),
    routeNames: noms,
    type: 'tab',
    stale: false,
    history: [{ type: 'route', key: 'index-k' }],
    routes: noms.map((n) => ({
      key: `${n}-k`,
      name: n,
      ...(piles[n]
        ? { state: { key: `${n}-pile`, index: piles[n].length - 1, routes: piles[n], stale: false } }
        : {}),
    })),
  };
}
const r = (name: string, params?: object, state?: RouteEtat[]): RouteEtat => ({
  key: `${name}-${JSON.stringify(params ?? {})}`,
  name,
  params,
  ...(state ? { state: { key: `${name}-imb`, index: state.length - 1, routes: state, stale: false } } : {}),
});

/** Chemins de la pile d'un onglet après une action RESET. */
function pileApres(action: ReturnType<typeof actionOuvrir>, onglet: string) {
  if (!action || action.type !== 'RESET') throw new Error('RESET attendu');
  const etat = action.payload;
  const route = etat.routes.find((x) => x.name === onglet)!;
  return {
    actif: etat.routes[etat.index].name,
    noms: (route.state?.routes ?? []).map((x) =>
      x.state ? `${x.name}>${x.state.routes.map((y) => y.name).join(',')}` : x.name,
    ),
    route,
    history: etat.history,
  };
}

describe('table des parents', () => {
  it('chaque écran du livreur a une entrée, et seulement eux', () => {
    expect(Object.keys(ROUTES).sort()).toEqual(ecrans());
  });

  it('chaque parent est un écran connu ou l’Accueil, et remonte à l’Accueil sans boucle', () => {
    for (const fichier of Object.keys(ROUTES)) {
      if (fichier === 'index') continue;
      let cible = { fichier, params: { id: 'x', famille: 'ventes' } as Record<string, string> };
      for (let n = 0; ; n++) {
        expect(n).toBeLessThan(6);
        const parent = parentDe(cible, PRINCIPAL);
        expect(parent).not.toBeNull();
        if (parent === ACCUEIL) break;
        const suivant = trouverRoute(parent!);
        expect(suivant).not.toBeNull();
        cible = suivant!;
      }
    }
  });

  it('formulaire → sa liste, fiche → sa liste, liste → Accueil, Accueil → rien', () => {
    const p = (chemin: string, ctx = PRINCIPAL) => parentDe(trouverRoute(chemin)!, ctx);
    expect(p('/cash/commandes/nouvelle')).toBe('/cash/commandes');
    expect(p('/clients/abc/modifier')).toBe('/clients/abc');
    expect(p('/clients/abc/prix')).toBe('/clients/abc');
    expect(p('/clients/abc')).toBe('/clients');
    expect(p('/cash/encaisser')).toBe('/cash/encaissements');
    expect(p('/cash/versement')).toBe('/cash/versements');
    expect(p('/livraisons/42')).toBe('/livraisons');
    expect(p('/cash/commandes/42')).toBe('/cash/commandes');
    expect(p('/cash/commandes/42', APPRENTI)).toBe('/cash/commandes/a-receptionner');
    for (const liste of ['/livraisons', '/clients', '/cash/encaissements', '/cash/encours', '/previsions', '/profil'])
      expect(p(liste)).toBe(ACCUEIL);
    expect(p('/')).toBeNull();
  });

  it('Dépenses, Reversements, Clôtures : ouvertes depuis Moi, elles reviennent à Moi', () => {
    const p = (chemin: string) => parentDe(trouverRoute(chemin)!, PRINCIPAL);
    for (const liste of ['/cash/depenses', '/cash/reversements', '/clotures']) expect(p(liste)).toBe('/profil');
    expect(p('/cash/depenses/nouvelle')).toBe('/cash/depenses');
    expect(p('/cash/reversements/historique')).toBe('/cash/reversements');
    expect(p('/clotures/nouvelle')).toBe('/clotures');
  });

  it('origine (depuis) : fiche client ou Encours, validée par la table', () => {
    const p = (chemin: string, params: Record<string, string>) => parentDe({ ...trouverRoute(chemin)!, params }, PRINCIPAL);
    for (const ecran of ['/cash/encaisser', '/livraisons/nouvelle', '/cash/retour-client', '/cash/retours'])
      expect(p(ecran, { clientId: 'c1', depuis: DEPUIS_CLIENT })).toBe('/clients/c1');
    expect(p('/livraisons/42', { id: '42', clientId: 'c1', depuis: 'client' })).toBe('/clients/c1');
    expect(p('/cash/encaisser', { clientId: 'c1', depuis: DEPUIS_ENCOURS })).toBe('/cash/encours');
    // Sans origine, origine inconnue, non admise ou incomplète : parent de la table.
    expect(p('/cash/encaisser', { clientId: 'c1' })).toBe('/cash/encaissements');
    expect(p('/cash/encaisser', { clientId: 'c1', depuis: '/profil/password' })).toBe('/cash/encaissements');
    expect(p('/livraisons/nouvelle', { clientId: 'c1', depuis: 'encours' })).toBe('/livraisons');
    expect(p('/cash/encaisser', { depuis: 'client' })).toBe('/cash/encaissements');
    // Un identifiant ne peut pas sortir de la fiche client : il est encodé en un seul segment.
    expect(parentOrigine({ fichier: 'cash/encaisser', params: { clientId: '../profil', depuis: 'client' } })).toBe('/clients/..%2Fprofil');
    // Clés du prototype : refusées, parent de la table (pas d'exception).
    for (const depuis of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      expect(p('/cash/encaisser', { clientId: 'c1', depuis })).toBe('/cash/encaissements');
      expect(p('/clients/c1/modifier', { id: 'c1', depuis })).toBe('/clients/c1');
      expect(parentOrigine({ fichier: 'livraisons/index', params: { depuis } })).toBeNull();
    }
    // Cloche → À réceptionner → commande / réceptions : retour à À réceptionner (livreur principal aussi).
    expect(p('/cash/commandes/9', { id: '9', depuis: DEPUIS_A_RECEPTIONNER })).toBe('/cash/commandes/a-receptionner');
    expect(p('/cash/commandes/receptions', { id: '9', depuis: DEPUIS_A_RECEPTIONNER })).toBe('/cash/commandes/a-receptionner');
    expect(p('/cash/commandes/9', { id: '9' })).toBe('/cash/commandes');
    // Commander depuis le cumul des prévisions : retour aux Prévisions.
    expect(p('/cash/commandes/nouvelle', { depuis: DEPUIS_PREVISIONS })).toBe('/previsions');
    expect(p('/cash/commandes/nouvelle', {})).toBe('/cash/commandes');
    // Cloche → Prévisions échues : retour à l'Accueil.
    expect(p('/previsions/echues', {})).toBe('/');
    // La fiche client garde la liste des clients pour parent.
    expect(p('/clients/c1', { id: 'c1', depuis: 'encours' })).toBe('/clients');
  });

  it('les segments fixes priment ; groupe et paramètres normalisés', () => {
    expect(trouverRoute('/clients/map')?.fichier).toBe('clients/map');
    expect(trouverRoute('/clients/abc')).toEqual({ fichier: 'clients/[id]/index', params: { id: 'abc' } });
    expect(trouverRoute('/cash')).toBeNull();
    expect(normaliserHref('/(livreur)/clients/[id]', { id: 'abc', onglet: 'x' })).toEqual({
      chemin: '/clients/abc',
      requete: { onglet: 'x' },
    });
    expect(normaliserHref('/(livreur)/cash/commandes/receptions?id=7')).toEqual({
      chemin: '/cash/commandes/receptions',
      requete: { id: '7' },
    });
  });
});

describe('pile propre (ouvrir)', () => {
  it('chaîne des parents restés dans la rubrique', () => {
    const chaine = chaineOuverture(trouverRoute('/cash/commandes/nouvelle')!, PRINCIPAL);
    expect(chaine.map((c) => c.fichier)).toEqual(['cash/commandes/index', 'cash/commandes/nouvelle']);
    expect(pileDe(chaine)).toEqual({ index: 0, routes: [{ name: 'commandes', state: { index: 1, routes: [{ name: 'index' }, { name: 'nouvelle' }] } }] });
    expect(pileDe(chaineOuverture(trouverRoute('/cash/versements')!, PRINCIPAL))).toEqual({
      index: 0,
      routes: [{ name: 'versements/index' }],
    });
  });

  it('menu + → Commandes après avoir visité d’autres écrans de la rubrique : pile [Commandes] seule', () => {
    const etat = onglets('index', {
      cash: [r('retours'), r('retour-client'), r('commandes', undefined, [r('index'), r('[id]', { id: '1' })])],
    });
    const p = pileApres(actionOuvrir(etat, '/(livreur)/cash/commandes', undefined, PRINCIPAL), 'cash');
    expect(p.actif).toBe('cash');
    expect(p.noms).toEqual(['commandes>index']);
    // Pile partielle : React Navigation la réhydrate (nouvelles clés).
    expect(p.route.state).not.toHaveProperty('key');
    expect(p.history?.[p.history.length - 1]).toEqual({ type: 'route', key: 'cash-k' });
  });

  it('formulaire ouvert depuis l’Accueil : [liste, formulaire] avec ses paramètres', () => {
    const p = pileApres(
      actionOuvrir(onglets('index'), '/(livreur)/livraisons/nouvelle', { clientId: 'c1' }, PRINCIPAL),
      'livraisons',
    );
    expect(p.noms).toEqual(['index', 'nouvelle']);
    expect(p.route.state?.routes[1].params).toEqual({ clientId: 'c1' });
  });

  it('écran déjà affiché sur sa pile propre : rien ; onglet caché avec la même pile : simple saut', () => {
    const etat = onglets('cash', { cash: [r('encaissements')] });
    expect(actionOuvrir(etat, '/(livreur)/cash/encaissements', undefined, PRINCIPAL)).toBeNull();
    expect(actionOuvrir(onglets('index', { livraisons: [r('index')] }), '/(livreur)/livraisons', undefined, PRINCIPAL)).toEqual({
      type: 'JUMP_TO',
      payload: { name: 'livraisons' },
      target: 'tabs',
    });
    // Paramètres différents ou pile plus haute : pile propre.
    expect(actionOuvrir(onglets('cash', { cash: [r('encaissements'), r('encaisser')] }), '/(livreur)/cash/encaissements', undefined, PRINCIPAL)?.type).toBe('RESET');
    expect(
      actionOuvrir(onglets('index', { livraisons: [r('index'), r('nouvelle', { clientId: 'a' })] }), '/(livreur)/livraisons/nouvelle', { clientId: 'b' }, PRINCIPAL)?.type,
    ).toBe('RESET');
  });

  it('Accueil : saut vers l’onglet Accueil', () => {
    expect(actionOuvrir(onglets('cash'), '/(livreur)', undefined, PRINCIPAL)).toEqual({
      type: 'JUMP_TO',
      payload: { name: 'index' },
      target: 'tabs',
    });
  });
});

describe('retour (parent logique)', () => {
  it('écran affiché', () => {
    const etat = onglets('cash', { cash: [r('commandes', undefined, [r('index'), r('[id]', { id: '9' })])] });
    expect(ecranActif(etat)).toEqual({ fichier: 'cash/commandes/[id]', params: { id: '9' }, chemin: '/cash/commandes/9' });
    expect(ecranActif(onglets('index'))?.fichier).toBe('index');
  });

  it('formulaire → liste présente plus bas : pile dépilée, clés conservées', () => {
    const etat = onglets('cash', { cash: [r('depenses', undefined, [r('index'), r('nouvelle')])] });
    const p = pileApres(actionRetour(etat, PRINCIPAL), 'cash');
    expect(p.noms).toEqual(['depenses>index']);
    expect(p.route.state).toHaveProperty('key', 'cash-pile');
    expect(p.route.state?.routes[0].state?.routes[0].key).toBe('index-{}');
  });

  it('formulaire ouvert seul (autre rubrique) → sa liste sur une pile propre', () => {
    const etat = onglets('cash', { cash: [r('encours'), r('encaisser', { clientId: 'c1' })] });
    expect(pileApres(actionRetour(etat, PRINCIPAL), 'cash').noms).toEqual(['encaissements']);
  });

  it('liste → Accueil directement, même avec des écrans visités plus bas', () => {
    const etat = onglets('cash', { cash: [r('retours'), r('encours')] });
    expect(actionRetour(etat, PRINCIPAL)).toEqual({ type: 'JUMP_TO', payload: { name: 'index' }, target: 'tabs' });
  });

  it('Accueil : aucune action (le système quitte l’application)', () => {
    expect(actionRetour(onglets('index'), PRINCIPAL)).toBeNull();
  });

  it('racine d’un onglet visible → Accueil', () => {
    expect(actionRetour(onglets('profil', { profil: [r('index')] }), PRINCIPAL)?.type).toBe('JUMP_TO');
  });

  it('après enregistrement : revenir à la liste (dépilée) sans doublon', () => {
    const etat = onglets('clients', { clients: [r('index'), r('[id]/index', { id: 'a' }), r('[id]/modifier', { id: 'a' })] });
    expect(pileApres(actionRevenirA(etat, '/(livreur)/clients', PRINCIPAL), 'clients').noms).toEqual(['index']);
  });
});

describe('naviguer (liens depuis un écran)', () => {
  it('même rubrique : empilé ; déjà dans la pile : dépilé (pas de doublon) ; écran courant : rien', () => {
    const etat = onglets('cash', { cash: [r('retours'), r('retour-client')] });
    expect(actionNaviguer(onglets('cash', { cash: [r('retours')] }), '/(livreur)/cash/retour-client', undefined, PRINCIPAL)).toBe('push');
    expect(pileApres(actionNaviguer(etat, '/(livreur)/cash/retours', undefined, PRINCIPAL) as never, 'cash').noms).toEqual(['retours']);
    expect(actionNaviguer(etat, '/(livreur)/cash/retour-client', undefined, PRINCIPAL)).toBeNull();
  });

  it('autre rubrique : pile propre', () => {
    const etat = onglets('clients', { clients: [r('index'), r('[id]/index', { id: 'a' })] });
    const p = pileApres(actionNaviguer(etat, '/(livreur)/cash/encaisser', { clientId: 'a' }, PRINCIPAL) as never, 'cash');
    expect(p.noms).toEqual(['encaissements', 'encaisser']);
  });
});

describe('état racine', () => {
  it('trouve le navigateur d’onglets sous __root / (livreur)', () => {
    const tabs = onglets('index');
    const racine = { key: 'r', index: 0, routes: [{ name: '__root', state: { key: 's', index: 0, routes: [{ name: '(livreur)', state: tabs }] } }] };
    expect(trouverOnglets(racine as never)).toBe(tabs);
    expect(trouverOnglets(undefined)).toBeUndefined();
  });
});
