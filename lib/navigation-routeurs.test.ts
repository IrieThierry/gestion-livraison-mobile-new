import { StackRouter, TabRouter } from '@react-navigation/routers';
import {
  actionOuvrir,
  actionRetour,
  ecranActif,
  PILES_IMBRIQUEES,
  ROUTES,
  type ActionOnglets,
  type EtatNavigateur,
} from './navigation';

/**
 * Les actions de lib/navigation passées aux VRAIS routeurs de React
 * Navigation (TabRouter firstRoute, StackRouter avec réhydratation des piles
 * partielles, comme useNavigationBuilder) : une forme de payload invalide
 * (routeNames, stale, nom de pile imbriquée…) serait refusée ici.
 */

const NOMS = ['index', 'clients', 'fab', 'livraisons', 'profil', 'cash', 'stock', 'previsions', 'clotures'];
const PRINCIPAL = { apprenti: false };
const options = (routeNames: string[]) => ({ routeNames, routeParamList: {}, routeGetIdList: {} });

/** Noms des écrans d'une pile (onglet ou pile imbriquée), d'après la table. */
function nomsDePile(dossier: string): string[] {
  const noms = new Set<string>();
  for (const f of Object.keys(ROUTES)) {
    if (!f.startsWith(`${dossier}/`)) continue;
    const reste = f.slice(dossier.length + 1).split('/');
    noms.add(PILES_IMBRIQUEES.has(`${dossier}/${reste[0]}`) && reste.length > 1 ? reste[0] : reste.join('/'));
  }
  return [...noms];
}

/** Réhydrate récursivement les piles partielles (ce que fait useNavigationBuilder). */
function hydrater(route: { name: string; state?: unknown }, dossier: string): void {
  const partiel = route.state as { stale?: boolean; routes: Array<{ name: string; state?: unknown }> } | undefined;
  if (!partiel) return;
  const noms = nomsDePile(dossier);
  const etat =
    partiel.stale === false ? partiel : StackRouter({}).getRehydratedState(partiel as never, options(noms));
  for (const r of etat.routes) if (PILES_IMBRIQUEES.has(`${dossier}/${r.name}`)) hydrater(r, `${dossier}/${r.name}`);
  route.state = etat;
}

const routeurOnglets = TabRouter({ backBehavior: 'firstRoute' });
function initial(): EtatNavigateur {
  return routeurOnglets.getInitialState(options(NOMS)) as unknown as EtatNavigateur;
}
function appliquer(etat: EtatNavigateur, action: ActionOnglets | null): EtatNavigateur {
  expect(action).not.toBeNull();
  expect(action!.target).toBe(etat.key);
  const suivant = routeurOnglets.getStateForAction(etat as never, action as never, options(NOMS) as never);
  expect(suivant).not.toBeNull();
  const copie = JSON.parse(JSON.stringify(suivant)) as EtatNavigateur;
  for (const r of copie.routes) hydrater(r, r.name);
  return copie;
}
/** Empile un écran dans la pile la plus profonde de l'onglet actif (router.push d'expo-router). */
function empiler(etat: EtatNavigateur, name: string, params: object): EtatNavigateur {
  const copie = JSON.parse(JSON.stringify(etat)) as EtatNavigateur;
  let route = copie.routes[copie.index] as { name: string; state?: EtatNavigateur };
  let dossier = route.name;
  for (;;) {
    const pile = route.state!;
    const haut = pile.routes[pile.index] as { name: string; state?: EtatNavigateur };
    if (haut.state && PILES_IMBRIQUEES.has(`${dossier}/${haut.name}`)) {
      dossier = `${dossier}/${haut.name}`;
      route = haut;
      continue;
    }
    route.state = StackRouter({}).getStateForAction(
      pile as never,
      { type: 'PUSH', payload: { name, params } } as never,
      options(nomsDePile(dossier)) as never,
    ) as unknown as EtatNavigateur;
    return copie;
  }
}

describe('lib/navigation avec les vrais routeurs', () => {
  it('cloche → À réceptionner → commande → retour : À réceptionner (clé conservée)', () => {
    const depart = initial();
    let etat = appliquer(depart, actionOuvrir(depart, '/(livreur)/cash/commandes/a-receptionner', undefined, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('cash/commandes/a-receptionner');
    const cle = etat.routes[etat.index].state!.routes[0].state!.routes[0].key;
    etat = empiler(etat, '[id]', { id: '9', depuis: 'a-receptionner' });
    expect(ecranActif(etat)).toMatchObject({ fichier: 'cash/commandes/[id]', chemin: '/cash/commandes/9' });
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('cash/commandes/a-receptionner');
    expect(etat.routes[etat.index].state!.routes[0].state!.routes[0].key).toBe(cle);
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('index');
    expect(actionRetour(etat, PRINCIPAL)).toBeNull();
  });

  it('fiche client → Encaisser (depuis=client) → retour : la fiche (clé conservée) → Clients → Accueil', () => {
    const depart = initial();
    let etat = appliquer(depart, actionOuvrir(depart, '/(livreur)/clients/[id]', { id: 'c1' }, PRINCIPAL));
    expect(ecranActif(etat)?.chemin).toBe('/clients/c1');
    const cleFiche = etat.routes[etat.index].state!.routes[1].key;
    etat = appliquer(etat, actionOuvrir(etat, '/(livreur)/cash/encaisser', { clientId: 'c1', depuis: 'client' }, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('cash/encaisser');
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.chemin).toBe('/clients/c1');
    expect(etat.routes[etat.index].state!.routes[1].key).toBe(cleFiche);
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.chemin).toBe('/clients');
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('index');
  });

  it('parcours du brief : + Commandes, Accueil, + Retours produits, Accueil → Encours, retour → Accueil', () => {
    const depart = initial();
    let etat = appliquer(depart, actionOuvrir(depart, '/(livreur)/cash/commandes', undefined, PRINCIPAL));
    etat = empiler(etat, '[id]', { id: '3' });
    etat = appliquer(etat, actionOuvrir(etat, '/(livreur)', undefined, PRINCIPAL));
    etat = appliquer(etat, actionOuvrir(etat, '/(livreur)/cash/retours', undefined, PRINCIPAL));
    expect(etat.routes[etat.index].state!.routes.map((r) => r.name)).toEqual(['retours']);
    etat = appliquer(etat, actionOuvrir(etat, '/(livreur)', undefined, PRINCIPAL));
    etat = appliquer(etat, actionOuvrir(etat, '/(livreur)/cash/encours', undefined, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('cash/encours');
    etat = appliquer(etat, actionRetour(etat, PRINCIPAL));
    expect(ecranActif(etat)?.fichier).toBe('index');
  });
});
