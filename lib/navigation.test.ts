import * as fs from 'fs';
import * as path from 'path';
import {
  ACCUEIL,
  ACCUEIL_LIVREUR,
  ecranApresConnexion,
  MOT_DE_PASSE_PROVISOIRE,
  accueilDuProfil,
  ACCUEIL_FOURNISSEUR,
  estCheminFournisseur,
  estProfilFournisseur,
  estProfilPortailWeb,
  GROUPE_FOURNISSEUR,
  parentFournisseur,
  PORTAIL_WEB,
  ROUTES_FOURNISSEUR,
  trouverRouteFournisseur,
  redirectionRacine,
  actionNaviguer,
  actionOuvrir,
  actionRetour,
  actionRevenirA,
  chaineOuverture,
  ecranActif,
  normaliserHref,
  DEPUIS_A_RECEPTIONNER,
  DEPUIS_APPRENTI,
  DEPUIS_CLIENT,
  DEPUIS_ENCOURS,
  DEPUIS_NOTIFICATIONS,
  DEPUIS_NOTIFICATIONS_RESPONSABLE,
  ECRANS_RESPONSABLE,
  estEcranResponsable,
  ongletVisible,
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
  const noms = ['index', 'clients', 'fab', 'livraisons', 'profil', 'cash', 'stock', 'previsions', 'clotures', 'notifications'];
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
    // Notifications → Commandes à réceptionner : retour à Notifications.
    expect(p('/cash/commandes/a-receptionner', { depuis: DEPUIS_NOTIFICATIONS })).toBe('/previsions/echues');
    expect(p('/cash/commandes/a-receptionner', {})).toBe('/');
    // Notifications → Transferts : retour à Notifications ; sinon Stock.
    expect(p('/stock/transferts', { depuis: DEPUIS_NOTIFICATIONS })).toBe('/previsions/echues');
    expect(p('/stock/transferts', { depuis: 'client' })).toBe('/stock');
    expect(p('/stock/transferts', {})).toBe('/stock');
    expect(p('/stock/transferts/nouveau', { depuis: DEPUIS_NOTIFICATIONS })).toBe('/stock/transferts');
    // Fiche apprenti → Remises des apprentis (filtrée) : retour à la fiche ; sinon Moi.
    expect(p('/profil/remises-apprentis', { apprentiId: 'A1', depuis: DEPUIS_APPRENTI })).toBe('/profil/apprentis/A1');
    expect(p('/profil/remises-apprentis', { apprentiId: 'A1' })).toBe('/profil');
    expect(p('/profil/remises-apprentis', { depuis: DEPUIS_APPRENTI })).toBe('/profil');
    expect(p('/profil/remises-apprentis', { apprentiId: 'A1', depuis: 'client' })).toBe('/profil');
    expect(p('/profil/remises-apprentis', { apprentiId: 'A1', depuis: '/profil/password' })).toBe('/profil');
    expect(p('/profil/remises-apprentis', {})).toBe('/profil');
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

  it('Transferts ouverts depuis Notifications → retour à Notifications (onglet Prévisions)', () => {
    const etat = onglets('stock', { stock: [r('transferts', undefined, [r('index', { depuis: DEPUIS_NOTIFICATIONS })])] });
    const p = pileApres(actionRetour(etat, PRINCIPAL), 'previsions');
    expect(p.actif).toBe('previsions');
    expect(p.noms).toEqual(['echues']);
    // Sans origine : retour à Stock.
    const sans = onglets('stock', { stock: [r('transferts', undefined, [r('index')])] });
    expect(pileApres(actionRetour(sans, PRINCIPAL), 'stock').noms).toEqual(['index']);
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

  it('Remises des apprentis ouverte depuis la fiche apprenti → retour à la fiche (dépilée)', () => {
    const fiche = r('apprentis', undefined, [r('index'), r('[id]', { id: 'A1' })]);
    const etat = onglets('profil', {
      profil: [r('index'), fiche, r('remises-apprentis', { apprentiId: 'A1', depuis: DEPUIS_APPRENTI })],
    });
    expect(pileApres(actionRetour(etat, PRINCIPAL), 'profil').noms).toEqual(['index', 'apprentis>index,[id]']);
    // Sans origine : retour à Moi.
    const sansOrigine = onglets('profil', { profil: [r('index'), fiche, r('remises-apprentis', { apprentiId: 'A1' })] });
    expect(pileApres(actionRetour(sansOrigine, PRINCIPAL), 'profil').noms).toEqual(['index']);
  });

  it('Remises des apprentis ouverte d’ailleurs avec l’origine apprenti → pile propre jusqu’à la fiche', () => {
    const etat = onglets('profil', { profil: [r('remises-apprentis', { apprentiId: 'A1', depuis: DEPUIS_APPRENTI })] });
    expect(pileApres(actionRetour(etat, PRINCIPAL), 'profil').noms).toEqual(['index', 'apprentis>index,[id]']);
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

describe('Profil : portail web (ADMIN), espace fournisseur (F1), onglets livreur', () => {
  const livreur = { profile: 'LIVREUR' };
  const fournisseur = { profile: 'FOURNISSEUR' };

  it('ADMIN va au portail web, FOURNISSEUR à son espace, le livreur (ou un profil absent) aux onglets', () => {
    expect(estProfilPortailWeb('ADMIN')).toBe(true);
    expect(estProfilPortailWeb('FOURNISSEUR')).toBe(false);
    expect(estProfilPortailWeb('LIVREUR')).toBe(false);
    expect(estProfilPortailWeb(undefined)).toBe(false);
    expect(estProfilFournisseur('FOURNISSEUR')).toBe(true);
    expect(estProfilFournisseur('ADMIN')).toBe(false);
    expect(estProfilFournisseur(undefined)).toBe(false);
    expect(accueilDuProfil('ADMIN')).toBe(PORTAIL_WEB);
    expect(accueilDuProfil('FOURNISSEUR')).toBe(ACCUEIL_FOURNISSEUR);
    expect(accueilDuProfil('LIVREUR')).toBe(ACCUEIL_LIVREUR);
    expect(accueilDuProfil(null)).toBe(ACCUEIL_LIVREUR);
    expect(ACCUEIL_FOURNISSEUR).toBe('/fournisseur');
  });

  it('après la connexion : le fournisseur arrive dans son espace (ou sur le mot de passe provisoire)', () => {
    expect(ecranApresConnexion(fournisseur)).toBe(ACCUEIL_FOURNISSEUR);
    expect(ecranApresConnexion({ ...fournisseur, motDePasseProvisoire: true })).toBe(MOT_DE_PASSE_PROVISOIRE);
  });

  it('redirection racine selon la session et le profil', () => {
    expect(redirectionRacine(null, '(livreur)')).toBe('/(auth)/login');
    expect(redirectionRacine(null, 'portail-web')).toBe('/(auth)/login');
    expect(redirectionRacine(null, GROUPE_FOURNISSEUR)).toBe('/(auth)/login');
    expect(redirectionRacine(null, '(auth)')).toBeNull();
    expect(redirectionRacine(livreur, '(auth)')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine({ profile: 'ADMIN' }, '(auth)')).toBe(PORTAIL_WEB);
    expect(redirectionRacine({ profile: 'ADMIN' }, '(livreur)')).toBe(PORTAIL_WEB);
    expect(redirectionRacine({ profile: 'ADMIN' }, GROUPE_FOURNISSEUR)).toBe(PORTAIL_WEB);
    expect(redirectionRacine({ profile: 'ADMIN' }, 'portail-web')).toBeNull();
    // F1 : le fournisseur n'est plus envoyé au portail web, il reste dans son espace.
    expect(redirectionRacine(fournisseur, '(auth)')).toBe(ACCUEIL_FOURNISSEUR);
    expect(redirectionRacine(fournisseur, '(livreur)')).toBe(ACCUEIL_FOURNISSEUR);
    expect(redirectionRacine(fournisseur, 'portail-web')).toBe(ACCUEIL_FOURNISSEUR);
    expect(redirectionRacine(fournisseur, 'mot-de-passe-provisoire')).toBe(ACCUEIL_FOURNISSEUR);
    expect(redirectionRacine(fournisseur, GROUPE_FOURNISSEUR)).toBeNull();
    expect(redirectionRacine(fournisseur, GROUPE_FOURNISSEUR, [GROUPE_FOURNISSEUR, 'commandes'])).toBeNull();
    expect(redirectionRacine({ ...fournisseur, motDePasseProvisoire: true }, GROUPE_FOURNISSEUR)).toBe(
      MOT_DE_PASSE_PROVISOIRE,
    );
    expect(redirectionRacine(livreur, 'portail-web')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(livreur, GROUPE_FOURNISSEUR)).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(livreur, '(livreur)')).toBeNull();
  });

  it('l’écran existe et est déclaré dans la pile racine', () => {
    const racine = path.join(__dirname, '..', 'app');
    expect(fs.existsSync(path.join(racine, 'portail-web.tsx'))).toBe(true);
    expect(PORTAIL_WEB).toBe('/portail-web');
    const layout = fs.readFileSync(path.join(racine, '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/<Stack\.Screen name="portail-web" \/>/);
    expect(layout).toMatch(/<Stack\.Screen name="fournisseur" \/>/);
  });
});

/** Fichiers d'écran de app/fournisseur (hors _layout), sans extension. */
function ecransFournisseur(): string[] {
  const racine = path.join(__dirname, '..', 'app', 'fournisseur');
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

describe('Espace fournisseur (F1, F2) : routes et parents', () => {
  it('chaque écran de app/fournisseur est déclaré dans ROUTES_FOURNISSEUR, et réciproquement', () => {
    expect(ecransFournisseur()).toEqual(Object.keys(ROUTES_FOURNISSEUR).sort());
  });

  it('les cinq onglets (Accueil, Commandes, Livreurs, Argent, Moi) et Notifications hors barre', () => {
    const layout = fs.readFileSync(path.join(__dirname, '..', 'app', 'fournisseur', '_layout.tsx'), 'utf8');
    for (const nom of ['index', 'commandes', 'livreurs', 'argent', 'moi']) expect(layout).toContain(`name="${nom}"`);
    expect(layout).toMatch(/name="notifications" options=\{\{ href: null \}\}/);
  });

  it('chemins de l’espace et écran correspondant', () => {
    expect(estCheminFournisseur('/fournisseur')).toBe(true);
    expect(estCheminFournisseur('/fournisseur/moi/infos')).toBe(true);
    expect(estCheminFournisseur('/fournisseurs')).toBe(false);
    expect(estCheminFournisseur('/profil/fournisseurs')).toBe(false);
    expect(trouverRouteFournisseur('/fournisseur')?.fichier).toBe('index');
    expect(trouverRouteFournisseur('/fournisseur/commandes')?.fichier).toBe('commandes/index');
    expect(trouverRouteFournisseur('/fournisseur/moi/password')?.fichier).toBe('moi/password');
    expect(trouverRouteFournisseur('/fournisseur/inconnu')).toBeNull();
    // Jamais confondus avec les écrans du livreur.
    expect(trouverRoute('/fournisseur')).toBeNull();
    expect(trouverRoute('/fournisseur/notifications')).toBeNull();
  });

  it('parent logique : Accueil → aucun ; onglet ou Notifications → Accueil ; formulaire de Moi → Moi', () => {
    expect(parentFournisseur('/fournisseur')).toBeNull();
    expect(parentFournisseur('/fournisseur/commandes')).toBe(ACCUEIL_FOURNISSEUR);
    expect(parentFournisseur('/fournisseur/livreurs')).toBe(ACCUEIL_FOURNISSEUR);
    expect(parentFournisseur('/fournisseur/argent')).toBe(ACCUEIL_FOURNISSEUR);
    expect(parentFournisseur('/fournisseur/moi')).toBe(ACCUEIL_FOURNISSEUR);
    expect(parentFournisseur('/fournisseur/notifications')).toBe(ACCUEIL_FOURNISSEUR);
    expect(parentFournisseur('/fournisseur/moi/infos')).toBe('/fournisseur/moi');
    expect(parentFournisseur('/fournisseur/moi/password')).toBe('/fournisseur/moi');
    // Écran inconnu : Accueil du fournisseur.
    expect(parentFournisseur('/fournisseur/inconnu')).toBe(ACCUEIL_FOURNISSEUR);
  });
});

describe('Plus d’écran d’attente de validation', () => {
  it('aucune référence à PendingValidation dans app/ et components/', () => {
    const trouves: string[] = [];
    const parcourir = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) parcourir(p);
        else if (/\.tsx?$/.test(e.name) && /PendingValidation|EN_ATTENTE_VALIDATION/.test(fs.readFileSync(p, 'utf8')))
          trouves.push(p);
      }
    };
    parcourir(path.join(__dirname, '..', 'app'));
    parcourir(path.join(__dirname, '..', 'components'));
    expect(trouves).toEqual([]);
  });
});

describe('Espace responsable (O15)', () => {
  const RESPONSABLE = { profile: 'LIVREUR', organisationId: 'o1', organisationRole: 'RESPONSABLE' as const };
  const COMMERCIAL = { profile: 'LIVREUR', organisationId: 'o1', organisationRole: 'COMMERCIAL' as const };

  it('Notifications du responsable : un onglet, liste dont le parent est l’Accueil (tableau de bord)', () => {
    expect(ROUTES.notifications).toEqual({ type: 'liste', parent: ACCUEIL });
    expect(parentDe(trouverRoute('/notifications')!, PRINCIPAL)).toBe(ACCUEIL);
  });

  it('Transferts et Remises ouverts depuis ses Notifications → retour à ses Notifications', () => {
    const p = (chemin: string, params: Record<string, string>) =>
      parentDe({ ...trouverRoute(chemin)!, params }, PRINCIPAL);
    expect(p('/stock/transferts', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })).toBe('/notifications');
    expect(p('/profil/remises-apprentis', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })).toBe('/notifications');
    // Sans origine : parents habituels.
    expect(p('/stock/transferts', {})).toBe('/stock');
    expect(p('/profil/remises-apprentis', {})).toBe('/profil');
    const etat = onglets('stock', {
      stock: [r('transferts', undefined, [r('index', { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE })])],
    });
    expect(actionRetour(etat, PRINCIPAL)).toEqual({ type: 'JUMP_TO', payload: { name: 'notifications' }, target: 'tabs' });
  });

  it('écrans permis au responsable : tableau de bord, notifications, Moi (compte), transferts et remises', () => {
    for (const f of [
      'index',
      'notifications',
      'profil/index',
      'profil/infos',
      'profil/password',
      'profil/apprentis/index',
      'profil/apprentis/[id]',
      'profil/remises-apprentis',
      'stock/transferts/index',
    ])
      expect(estEcranResponsable(f)).toBe(true);
    for (const f of [
      'livraisons/index',
      'livraisons/nouvelle',
      'cash/encaisser',
      'cash/retour-client',
      'clients/index',
      'fab',
      'stock/index',
      'stock/transferts/nouveau',
      'previsions/echues',
      'profil/prix',
      'profil/apprentis/nouveau',
    ])
      expect(estEcranResponsable(f)).toBe(false);
    // Chaque écran permis est déclaré dans la table.
    for (const f of ECRANS_RESPONSABLE) expect(ROUTES[f]).toBeDefined();
  });

  it('pas d’onglets de vente pour le responsable', () => {
    for (const nom of ['clients', 'fab', 'livraisons']) {
      expect(ongletVisible(nom, true)).toBe(false);
      expect(ongletVisible(nom, false)).toBe(true);
    }
    for (const nom of ['index', 'notifications', 'profil']) expect(ongletVisible(nom, true)).toBe(true);
    expect(ongletVisible('notifications', false)).toBe(false);
  });

  it('redirection : le responsable arrive sur son espace et n’entre pas dans un écran de vente', () => {
    expect(accueilDuProfil('LIVREUR')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, '(auth)')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, 'portail-web')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'index'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'notifications'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'profil'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'profil', 'remises-apprentis'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'stock', 'transferts'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'stock', 'transferts', 'index'])).toBeNull();
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'livraisons', 'nouvelle'])).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'clients', '[id]'])).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'cash', 'encaisser'])).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'stock', 'transferts', 'nouveau'])).toBe(
      ACCUEIL_LIVREUR,
    );
    expect(redirectionRacine(RESPONSABLE, '(livreur)', ['(livreur)', 'inconnu'])).toBe(ACCUEIL_LIVREUR);
  });

  it('commercial, livreur et ancienne session : aucune restriction', () => {
    expect(redirectionRacine(COMMERCIAL, '(livreur)', ['(livreur)', 'livraisons', 'nouvelle'])).toBeNull();
    expect(redirectionRacine({ profile: 'LIVREUR' }, '(livreur)', ['(livreur)', 'livraisons', 'nouvelle'])).toBeNull();
    // Rôle sans organisation : pas responsable.
    expect(
      redirectionRacine({ profile: 'LIVREUR', organisationRole: 'RESPONSABLE' }, '(livreur)', ['(livreur)', 'fab']),
    ).toBeNull();
  });
});

describe('Espace responsable : branchement des layouts', () => {
  it('onglet Notifications déclaré, onglets de vente masqués selon le rôle, segments passés à la redirection', () => {
    const app = path.join(__dirname, '..', 'app');
    const onglets = fs.readFileSync(path.join(app, '(livreur)', '_layout.tsx'), 'utf8');
    expect(onglets).toMatch(/name="notifications"/);
    for (const nom of ['clients', 'fab', 'livraisons', 'notifications']) expect(onglets).toContain(`masque('${nom}')`);
    expect(onglets).toMatch(/ongletVisible\(nom, responsable\)/);
    const racine = fs.readFileSync(path.join(app, '_layout.tsx'), 'utf8');
    expect(racine).toMatch(/redirectionRacine\(user, segments\[0\], segments\)/);
  });
});

describe('Transferts du responsable ouverts depuis Moi (ou par un lien)', () => {
  const RESP = { apprenti: false, responsable: true };

  it('pile [Transferts] seule (jamais Stock dessous), retour à Moi', () => {
    const depuisMoi = onglets('profil', { profil: [r('index')] });
    const action = actionNaviguer(depuisMoi, '/(livreur)/stock/transferts', undefined, RESP);
    const p = pileApres(action as ReturnType<typeof actionOuvrir>, 'stock');
    expect(p.actif).toBe('stock');
    expect(p.noms).toEqual(['transferts>index']);
    expect(p.noms).not.toContain('index');

    const affiche = onglets('stock', { stock: [r('transferts', undefined, [r('index')])], profil: [r('index')] });
    const retour = actionRetour(affiche, RESP);
    expect(retour?.type).toBe('RESET');
    expect(pileApres(retour, 'profil').actif).toBe('profil');
  });

  it('lien profond (Stock monté dessous) : le retour va aussi à Moi, pas à Stock', () => {
    const lien = onglets('stock', { stock: [r('index'), r('transferts', undefined, [r('index')])] });
    expect(parentDe(trouverRoute('/stock/transferts')!, RESP)).toBe('/profil');
    expect(pileApres(actionRetour(lien, RESP), 'profil').actif).toBe('profil');
    // Livreur principal : parent Stock inchangé.
    expect(parentDe(trouverRoute('/stock/transferts')!, PRINCIPAL)).toBe('/stock');
  });

  it('ouverte depuis les Notifications du responsable : retour aux Notifications', () => {
    const cible = { ...trouverRoute('/stock/transferts')!, params: { depuis: DEPUIS_NOTIFICATIONS_RESPONSABLE } };
    expect(parentDe(cible, RESP)).toBe('/notifications');
  });
});

describe('Mot de passe provisoire (M1)', () => {
  const provisoire = { profile: 'LIVREUR', motDePasseProvisoire: true };

  it('après la connexion : écran de changement si provisoire, sinon accueil du profil', () => {
    expect(ecranApresConnexion(provisoire)).toBe(MOT_DE_PASSE_PROVISOIRE);
    expect(ecranApresConnexion({ profile: 'LIVREUR' })).toBe(ACCUEIL_LIVREUR);
    expect(ecranApresConnexion({ profile: 'ADMIN', motDePasseProvisoire: false })).toBe('/portail-web');
  });

  it('tant qu’il est provisoire, aucune autre page', () => {
    for (const seg of ['(livreur)', '(auth)', 'portail-web', undefined]) {
      expect(redirectionRacine(provisoire, seg)).toBe(MOT_DE_PASSE_PROVISOIRE);
    }
    expect(redirectionRacine(provisoire, 'mot-de-passe-provisoire')).toBeNull();
  });

  it('changé : l’écran de changement renvoie à l’accueil ; non connecté : connexion', () => {
    expect(redirectionRacine({ profile: 'LIVREUR' }, 'mot-de-passe-provisoire')).toBe(ACCUEIL_LIVREUR);
    expect(redirectionRacine(null, 'mot-de-passe-provisoire')).toBe('/(auth)/login');
  });

  it('l’écran existe et est déclaré dans la pile racine', () => {
    const racine = path.join(__dirname, '..', 'app');
    expect(fs.existsSync(path.join(racine, 'mot-de-passe-provisoire.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(racine, '(auth)', 'mot-de-passe-oublie.tsx'))).toBe(true);
    const layout = fs.readFileSync(path.join(racine, '_layout.tsx'), 'utf8');
    expect(layout).toMatch(/<Stack\.Screen name="mot-de-passe-provisoire"/);
  });

  it('Mes apprentis ouverte depuis les Notifications y revient', () => {
    expect(ROUTES['profil/apprentis/index'].origines).toMatchObject({
      notifications: '/previsions/echues',
      'notifications-responsable': '/notifications',
    });
  });
});
