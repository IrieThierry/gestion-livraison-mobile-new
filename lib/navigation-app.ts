import { useEffect } from 'react';
import { BackHandler } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import {
  ACCUEIL,
  actionNaviguer,
  actionOuvrir,
  actionRetour,
  actionRevenirA,
  ecranActif,
  normaliserHref,
  parentDe,
  trouverOnglets,
  trouverRoute,
  type ActionOnglets,
  type ContexteNavigation,
  type EtatNavigateur,
} from './navigation';

/**
 * Application de la règle de navigation (lib/navigation.ts) au navigateur
 * réel. Le layout `(livreur)` branche la référence du conteneur de
 * navigation (`brancherNavigation`) ; sans elle (tests d'écran, conteneur
 * pas prêt), on retombe sur le routeur expo-router.
 */

type Params = Record<string, string | number | undefined>;

export interface RefNavigation {
  isReady(): boolean;
  getRootState(): unknown;
  dispatch(action: ActionOnglets): void;
}

let ref: RefNavigation | null = null;

/** Branche la référence du conteneur de navigation (layout `(livreur)`). */
export function brancherNavigation(r: RefNavigation | null): void {
  ref = r;
}

function contexte(): ContexteNavigation {
  return { apprenti: !!useAuthStore.getState().user?.parentId };
}

function onglets(): EtatNavigateur | undefined {
  if (!ref?.isReady()) return undefined;
  return trouverOnglets(ref.getRootState() as EtatNavigateur | undefined);
}

function hrefRouteur(href: string, params?: Params) {
  const { chemin, requete } = normaliserHref(href, params);
  return (Object.keys(requete).length ? { pathname: chemin, params: requete } : chemin) as never;
}

/**
 * Ouvre un écran sur une pile propre (menu +, Accueil, menus) : la pile de
 * sa rubrique est remplacée par [parents dans la rubrique…, écran].
 */
export function ouvrir(href: string, params?: Params): void {
  const t = onglets();
  const action = t ? actionOuvrir(t, href, params, contexte()) : null;
  if (action && ref) ref.dispatch(action);
  else router.navigate(hrefRouteur(href, params));
}

/**
 * Lien depuis un écran : autre rubrique → pile propre ; même rubrique →
 * empilé (ou dépilé s'il est déjà dans la pile : jamais de doublon).
 */
export function naviguer(href: string, params?: Params): void {
  const t = onglets();
  if (!t || !ref) {
    router.push(hrefRouteur(href, params));
    return;
  }
  const action = actionNaviguer(t, href, params, contexte());
  if (action === 'push') router.push(hrefRouteur(href, params));
  else if (action) ref.dispatch(action);
}

/** Revient à un écran (après enregistrement : la liste du module). */
export function revenirA(href: string): void {
  const t = onglets();
  const action = t ? actionRevenirA(t, href, contexte()) : null;
  if (action && ref) ref.dispatch(action);
  else if (normaliserHref(href).chemin === ACCUEIL) router.navigate('/(livreur)' as never);
  else router.dismissTo(hrefRouteur(href));
}

/**
 * Retour vers le parent logique de l'écran affiché. Renvoie false sur
 * l'Accueil (le système applique son comportement : quitter l'application).
 * `chemin` : écran courant connu de l'appelant, utilisé si l'état de
 * navigation n'est pas disponible.
 */
export function retourParent(chemin?: string): boolean {
  const t = onglets();
  if (t && ref) {
    if (!ecranActif(t)) return false;
    const action = actionRetour(t, contexte());
    if (!action) return false;
    ref.dispatch(action);
    return true;
  }
  const cible = chemin ? trouverRoute(normaliserHref(chemin).chemin) : null;
  const parent = cible ? parentDe(cible, contexte()) : null;
  if (parent === null) {
    if (router.canGoBack()) {
      router.back();
      return true;
    }
    return false;
  }
  revenirA(parent);
  return true;
}

/**
 * Bouton / geste retour Android : suit la même table que la flèche
 * d'en-tête. Le listener est ré-enregistré à chaque changement d'écran pour
 * passer avant celui de React Navigation (le dernier enregistré est appelé
 * en premier). Sur l'Accueil il laisse faire le système.
 */
export function useRetourMateriel(): void {
  const pathname = usePathname();
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => retourParent(pathname));
    return () => sub.remove();
  }, [pathname]);
}
