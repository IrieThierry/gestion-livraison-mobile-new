/**
 * Onglets du bas : un appui sur un onglet (actif ou non) ouvre toujours sa
 * page principale. Si la pile interne de l'onglet contient des sous-routes
 * (ex. Accueil → avatar → « Mes infos » laisse la pile Moi sur « infos »),
 * elle est ramenée à sa racine avant d'afficher l'onglet.
 *
 * Fonction pure (sans dépendance à React Navigation) pour être testée ; le
 * listener `tabPress` du layout l'applique à la pile de l'onglet.
 */

/** Nom de l'écran racine d'une pile d'onglet. */
export const RACINE_ONGLET = 'index';

/** État minimal du navigateur d'onglets (sous-ensemble de React Navigation). */
export interface EtatOnglets {
  routes: ReadonlyArray<{
    key: string;
    name: string;
    state?: {
      key?: string;
      index?: number;
      routes?: ReadonlyArray<{ name: string }>;
    };
  }>;
}

/** Action à envoyer à la pile interne de l'onglet (champ `target` = sa clé). */
export type ActionRacineOnglet =
  | { type: 'POP_TO_TOP'; target: string }
  | { type: 'RESET'; target: string; payload: { index: 0; routes: Array<{ name: string }> } };

/**
 * Action qui ramène la pile de l'onglet `routeKey` à sa racine, ou null s'il
 * n'y a rien à faire (pile pas encore montée, déjà sur la racine, onglet
 * sans pile). Jamais d'action sans effet : pas de warning de navigation.
 *  - racine en bas de pile + sous-routes → POP_TO_TOP (l'écran racine garde son état) ;
 *  - pile sans la racine en bas (sous-route ouverte directement) → RESET sur la racine.
 */
export function actionRacineOnglet(
  etat: EtatOnglets | undefined,
  routeKey: string,
  racine: string = RACINE_ONGLET,
): ActionRacineOnglet | null {
  const onglet = etat?.routes?.find((r) => r.key === routeKey);
  const pile = onglet?.state;
  const routes = pile?.routes ?? [];
  if (!pile?.key || routes.length === 0) return null;
  if (routes[0].name !== racine) {
    return { type: 'RESET', target: pile.key, payload: { index: 0, routes: [{ name: racine }] } };
  }
  if (routes.length > 1) return { type: 'POP_TO_TOP', target: pile.key };
  return null;
}

/** Sous-ensemble de la `navigation` d'un écran d'onglet utilisé par le listener. */
export interface NavigationOnglet {
  getState?: () => EtatOnglets | undefined;
  isFocused?: () => boolean;
  dispatch?: (action: ActionRacineOnglet) => void;
}

/**
 * Fabrique des `listeners` d'un `Tabs.Screen` : sur `tabPress`, ramène la
 * pile de l'onglet à sa racine (`actionRacineOnglet`).
 *  - onglet déjà actif : `preventDefault` (seule la pile change) ;
 *  - onglet inactif : le comportement par défaut affiche l'onglet, pile vidée ;
 *  - rien à faire : ni dispatch ni `preventDefault`.
 */
export function listenersRacineOnglet() {
  return ({ navigation, route }: { navigation: NavigationOnglet; route: { key: string } }) => ({
    tabPress: (e: { preventDefault: () => void }) => {
      const action = actionRacineOnglet(navigation?.getState?.(), route.key);
      if (!action) return;
      if (navigation.isFocused?.()) e.preventDefault();
      navigation.dispatch?.(action);
    },
  });
}
