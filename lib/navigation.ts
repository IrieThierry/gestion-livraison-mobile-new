/**
 * Règle de navigation unique de l'app : le bouton retour (flèche d'en-tête,
 * bouton ou geste retour Android) ramène au PARENT LOGIQUE de l'écran.
 *
 *  | Écran                                   | Retour            |
 *  |-----------------------------------------|-------------------|
 *  | formulaire (création / modification)    | sa liste          |
 *  | fiche (client, commande, livraison…)    | sa liste          |
 *  | liste (Mes livraisons, Commandes…)      | Accueil           |
 *  | Accueil                                 | quitter l'app     |
 *
 * La table `ROUTES` donne le parent de chaque écran du livreur. Les
 * sous-pages d'une page de rubrique (Stock → Mouvements, Moi → Mes infos,
 * Reversements → Historique…) ont pour parent cette page ; l'étape 2 de la
 * création d'un client a pour parent l'étape 1.
 *
 * Dépenses, Reversements et Clôtures s'ouvrent depuis l'onglet Moi : leur
 * liste a pour parent Moi (`/profil`).
 *
 * Ouvrir un écran depuis le menu +, l'Accueil ou un autre onglet repart
 * d'une pile propre : la pile de la rubrique est remplacée par la chaîne
 * des parents de l'écran restés dans la rubrique (ex. [Commandes, Commande
 * CMD-1]). Revenir à un écran déjà dans la pile le dépile (jamais de
 * doublon).
 *
 * Fonctions pures (sans dépendance à expo-router) : elles calculent les
 * actions à envoyer au navigateur d'onglets ; `lib/navigation-app.ts` les
 * applique.
 */

// ---------------------------------------------------------------------------
// Profil : livreur (onglets), fournisseur (son espace) ou portail web (ADMIN)
// ---------------------------------------------------------------------------

/** Groupe des onglets du livreur (cible après la connexion d'un livreur). */
export const ACCUEIL_LIVREUR = '/(livreur)';

/**
 * F1 : espace du fournisseur (`app/fournisseur/`, onglets du bas). Dossier
 * (et non groupe) : ses chemins `/fournisseur/…` ne se mêlent jamais à ceux
 * du livreur (`/profil`, `/notifications`…), comme sur le portail web.
 */
export const ACCUEIL_FOURNISSEUR = '/fournisseur';

/** Premier segment de route de l'espace fournisseur (nom de la route dans la pile racine). */
export const GROUPE_FOURNISSEUR = 'fournisseur';

/**
 * Écran « Utilisez le portail web » (`app/portail-web.tsx`, déclaré dans la
 * pile racine) : un compte ADMIN n'a pas d'espace sur mobile.
 */
export const PORTAIL_WEB = '/portail-web';

/** Premier segment de route de l'écran portail web. */
const SEGMENT_PORTAIL_WEB = 'portail-web';

/** Seul l'ADMIN utilise le portail web ; un profil absent (ancienne session) reste livreur. */
export function estProfilPortailWeb(profile: string | null | undefined): boolean {
  return profile === 'ADMIN';
}

/** F1 : compte fournisseur (son espace sur le mobile). */
export function estProfilFournisseur(profile: string | null | undefined): boolean {
  return profile === 'FOURNISSEUR';
}

/**
 * Espace du commis d'un fournisseur (`app/commis/`, onglets du bas) : il n'a
 * ni onglets livreur ni espace fournisseur.
 */
export const ACCUEIL_COMMIS = '/commis';

/** Premier segment de route de l'espace commis (nom de la route dans la pile racine). */
export const GROUPE_COMMIS = 'commis';

/** Compte commis d'un fournisseur (son espace sur le mobile). */
export function estProfilCommis(profile: string | null | undefined): boolean {
  return profile === 'COMMIS';
}

/**
 * Écran d'arrivée après la connexion selon le profil. Le responsable d'une
 * organisation (profil LIVREUR) arrive lui aussi sur `(livreur)` : son
 * Accueil y est le tableau de bord de son espace (O15).
 */
export function accueilDuProfil(profile: string | null | undefined): string {
  if (estProfilPortailWeb(profile)) return PORTAIL_WEB;
  if (estProfilFournisseur(profile)) return ACCUEIL_FOURNISSEUR;
  if (estProfilCommis(profile)) return ACCUEIL_COMMIS;
  return ACCUEIL_LIVREUR;
}

/**
 * M1 : écran « Choisis ton nouveau mot de passe » (`app/mot-de-passe-provisoire.tsx`,
 * pile racine). Ouvert après la connexion avec un mot de passe provisoire ;
 * aucune autre page n'est accessible tant qu'il n'est pas changé.
 */
export const MOT_DE_PASSE_PROVISOIRE = '/mot-de-passe-provisoire';

/** Premier segment de route de l'écran du mot de passe provisoire. */
const SEGMENT_MOT_DE_PASSE_PROVISOIRE = 'mot-de-passe-provisoire';

/** Utilisateur vu par la redirection racine (champs de session). */
export interface UtilisateurRedirection {
  profile?: string | null;
  organisationId?: string | null;
  organisationRole?: string | null;
  /** M1 : mot de passe provisoire à changer avant tout accès. */
  motDePasseProvisoire?: boolean | null;
}

/** Écran après la connexion : changement forcé si le mot de passe est provisoire (M1), sinon l'accueil du profil. */
export function ecranApresConnexion(user: UtilisateurRedirection): string {
  return user.motDePasseProvisoire ? MOT_DE_PASSE_PROVISOIRE : accueilDuProfil(user.profile);
}

/** Responsable d'une organisation (même règle que `estResponsable` de features/organisation). */
function estResponsableOrganisation(user: UtilisateurRedirection): boolean {
  return !!user.organisationId && user.organisationRole === 'RESPONSABLE';
}

/**
 * Redirection de la pile racine (`AuthGate`) : non connecté hors `(auth)` →
 * connexion ; connecté dans `(auth)` → écran de son profil ; ADMIN hors du
 * portail web → portail web ; FOURNISSEUR hors de son espace → son Accueil
 * (F1) ; COMMIS hors de son espace → son espace (jamais les onglets livreur
 * ni l'espace fournisseur) ; livreur sur le portail web, dans l'espace
 * fournisseur ou commis → onglets.
 * Responsable d'une organisation (O15) : hors des écrans de
 * son espace (`ECRANS_RESPONSABLE`, d'après `segments`, les segments de
 * route d'expo-router) → son Accueil. Null : rester où l'on est.
 */
export function redirectionRacine(
  user: UtilisateurRedirection | null,
  premierSegment: string | undefined,
  segments?: readonly string[],
): string | null {
  const dansAuth = premierSegment === '(auth)';
  if (!user) return dansAuth ? null : '/(auth)/login';
  // M1 : mot de passe provisoire → seul l'écran de changement est accessible.
  const surProvisoire = premierSegment === SEGMENT_MOT_DE_PASSE_PROVISOIRE;
  if (user.motDePasseProvisoire) return surProvisoire ? null : MOT_DE_PASSE_PROVISOIRE;
  if (surProvisoire) return accueilDuProfil(user.profile);
  if (dansAuth) return accueilDuProfil(user.profile);
  if (estProfilPortailWeb(user.profile)) return premierSegment === SEGMENT_PORTAIL_WEB ? null : PORTAIL_WEB;
  if (estProfilFournisseur(user.profile)) return premierSegment === GROUPE_FOURNISSEUR ? null : ACCUEIL_FOURNISSEUR;
  if (estProfilCommis(user.profile)) return premierSegment === GROUPE_COMMIS ? null : ACCUEIL_COMMIS;
  if (premierSegment === SEGMENT_PORTAIL_WEB || premierSegment === GROUPE_FOURNISSEUR || premierSegment === GROUPE_COMMIS)
    return ACCUEIL_LIVREUR;
  if (premierSegment === GROUPE_LIVREUR && segments && estResponsableOrganisation(user)) {
    const chemin = `/${segments.slice(1).filter((s) => s !== 'index').join('/')}`;
    if (chemin === ACCUEIL) return null;
    const cible = trouverRoute(chemin);
    if (!cible || !estEcranResponsable(cible.fichier)) return ACCUEIL_LIVREUR;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Espace responsable (O15) : lecture, sans onglets de vente
// ---------------------------------------------------------------------------

/**
 * Écrans de l'espace du responsable sur le mobile : tableau de bord
 * (Accueil), Notifications (déchargements à accepter ou refuser, remises
 * d'argent à confirmer ou contester), Moi (compte, « Mes commerciaux » en
 * lecture), et les listes des
 * transferts et des remises où il prend ces deux décisions. Le reste
 * (ventes, clients, stock, gestion) se fait sur le portail web.
 */
export const ECRANS_RESPONSABLE: ReadonlySet<string> = new Set([
  'index',
  'notifications',
  'profil/index',
  'profil/infos',
  'profil/password',
  // « Mes commerciaux » en lecture (ni création ni activation sur le mobile).
  'profil/apprentis/index',
  'profil/apprentis/[id]',
  'profil/remises-apprentis',
  'stock/transferts/index',
  // Localisation : positions de ses commerciaux (ouvert depuis Moi ou une notification).
  'localiser',
]);

export function estEcranResponsable(fichier: string): boolean {
  return ECRANS_RESPONSABLE.has(fichier);
}

/** Onglets de vente, jamais proposés au responsable. */
const ONGLETS_VENTE: ReadonlySet<string> = new Set(['clients', 'fab', 'livraisons']);

/**
 * Onglet affiché dans la barre : le responsable n'a pas les onglets de vente
 * mais a « Notifications » ; les autres utilisateurs, l'inverse.
 */
export function ongletVisible(nom: string, responsable: boolean): boolean {
  if (nom === 'notifications') return responsable;
  return !(responsable && ONGLETS_VENTE.has(nom));
}

/** Chemin de l'Accueil (onglet Tournée). */
export const ACCUEIL = '/';

export type TypeEcran = 'accueil' | 'liste' | 'fiche' | 'formulaire';

export interface ContexteNavigation {
  /** Apprenti : ses « Commandes » sont celles à réceptionner. */
  apprenti: boolean;
  /**
   * Responsable d'une organisation (O15) : Stock n'est pas dans son espace,
   * ses Transferts ont pour parent Moi (`/profil`).
   */
  responsable?: boolean;
}

type Parametres = Record<string, string>;

export interface RouteApp {
  type: TypeEcran;
  /**
   * Chemin du parent (segments `[x]` remplis avec les paramètres de
   * l'écran) ; null pour l'Accueil.
   */
  parent: string | null | ((ctx: ContexteNavigation) => string);
  /**
   * Origines admises (paramètre `depuis`) : l'écran ouvert depuis un autre
   * a pour parent cet autre écran (gabarit rempli avec ses paramètres). Seules
   * ces valeurs sont acceptées : jamais une route arbitraire venue des paramètres.
   */
  origines?: Readonly<Partial<Record<Origine, string>>>;
}

/**
 * Origines d'un écran (paramètre `depuis`) :
 *  - `client` : ouvert depuis la fiche client (paramètre `clientId`) ;
 *  - `encours` : ouvert depuis la liste Encours ;
 *  - `a-receptionner` : ouvert depuis « À réceptionner » (cloche de l'Accueil) ;
 *  - `previsions` : ouvert depuis Prévisions (Commander depuis le cumul) ;
 *  - `notifications` : ouvert depuis l'écran Notifications (cloche de l'Accueil),
 *    par une action rapide ou par une notification du fil (N8) ;
 *  - `apprenti` : ouvert depuis la fiche apprenti (paramètre `apprentiId`) ;
 *  - `notifications-responsable` : ouvert depuis les Notifications du responsable ;
 *  - `clients` : ouvert depuis la liste « Mes clients » ;
 *  - `moi` : ouvert depuis l'onglet Moi.
 */
export type Origine =
  | 'client'
  | 'encours'
  | 'a-receptionner'
  | 'previsions'
  | 'notifications'
  | 'apprenti'
  | 'notifications-responsable'
  | 'clients'
  | 'moi';
export const DEPUIS_CLIENT = 'client' as const;
export const DEPUIS_ENCOURS = 'encours' as const;
export const DEPUIS_A_RECEPTIONNER = 'a-receptionner' as const;
export const DEPUIS_PREVISIONS = 'previsions' as const;
export const DEPUIS_NOTIFICATIONS = 'notifications' as const;
export const DEPUIS_APPRENTI = 'apprenti' as const;
export const DEPUIS_NOTIFICATIONS_RESPONSABLE = 'notifications-responsable' as const;
export const DEPUIS_CLIENTS = 'clients' as const;
export const DEPUIS_MOI = 'moi' as const;
/** Notifications du responsable (onglet de son espace). */
const NOTIFICATIONS_RESPONSABLE = '/notifications';
/** Notifications du livreur (cloche de l'Accueil, N8) : retour depuis l'écran ouvert par une notification. */
const NOTIFICATIONS_LIVREUR = '/previsions/echues';
const A_RECEPTIONNER = '/cash/commandes/a-receptionner';
const FICHE_CLIENT = '/clients/[clientId]';

/** Parent des Transferts : Stock, ou Moi pour le responsable (sans Stock dans son espace). */
const parentTransferts = (ctx: ContexteNavigation) => (ctx.responsable ? '/profil' : '/stock');

const listeCommandes = (ctx: ContexteNavigation) =>
  ctx.apprenti ? '/cash/commandes/a-receptionner' : '/cash/commandes';

/**
 * Écrans du livreur, par fichier (relatif à `app/(livreur)`, sans extension)
 * → type et parent. Chaque fichier d'écran doit y figurer (test).
 */
export const ROUTES: Readonly<Record<string, RouteApp>> = {
  index: { type: 'accueil', parent: null },
  fab: { type: 'liste', parent: ACCUEIL },
  // Espace responsable (O15) : onglet Notifications (déchargements, remises d'argent).
  notifications: { type: 'liste', parent: ACCUEIL },

  'clients/index': { type: 'liste', parent: ACCUEIL, origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'clients/map': { type: 'liste', parent: '/clients' },
  'clients/[id]/index': { type: 'fiche', parent: '/clients' },
  // Ouverts seulement depuis la fiche : elle est leur parent.
  'clients/[id]/modifier': { type: 'formulaire', parent: '/clients/[id]' },
  'clients/[id]/prix': { type: 'formulaire', parent: '/clients/[id]' },
  'clients/nouveau/index': { type: 'formulaire', parent: '/clients' },
  'clients/nouveau/localisation': { type: 'formulaire', parent: '/clients/nouveau' },

  'livraisons/index': { type: 'liste', parent: ACCUEIL },
  'livraisons/[id]': { type: 'fiche', parent: '/livraisons', origines: { client: FICHE_CLIENT } },
  'livraisons/nouvelle': { type: 'formulaire', parent: '/livraisons', origines: { client: FICHE_CLIENT } },
  'livraisons/produits-vendus': { type: 'liste', parent: ACCUEIL },

  'cash/encaissements': { type: 'liste', parent: ACCUEIL },
  'cash/encaisser': {
    type: 'formulaire',
    parent: '/cash/encaissements',
    origines: { client: FICHE_CLIENT, encours: '/cash/encours' },
  },
  'cash/encours': { type: 'liste', parent: ACCUEIL },
  'cash/retours': { type: 'liste', parent: ACCUEIL, origines: { client: FICHE_CLIENT } },
  'cash/retour-client': { type: 'formulaire', parent: '/cash/retours', origines: { client: FICHE_CLIENT } },
  'cash/versements/index': { type: 'liste', parent: ACCUEIL },
  'cash/versement': { type: 'formulaire', parent: '/cash/versements' },
  // N7 : demandes de modification de versement, ouvertes depuis « Mes versements » ou Moi.
  'cash/versements/demandes': {
    type: 'liste',
    parent: '/cash/versements',
    origines: { moi: '/profil', notifications: NOTIFICATIONS_LIVREUR },
  },
  'cash/versements/modifier': { type: 'formulaire', parent: '/cash/versements' },
  'cash/commandes/index': { type: 'liste', parent: ACCUEIL, origines: { notifications: NOTIFICATIONS_LIVREUR } },
  // Ouverte depuis Notifications (cloche) : retour à Notifications.
  'cash/commandes/a-receptionner': { type: 'liste', parent: ACCUEIL, origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'cash/commandes/[id]': {
    type: 'fiche',
    parent: listeCommandes,
    origines: { 'a-receptionner': A_RECEPTIONNER, notifications: NOTIFICATIONS_LIVREUR },
  },
  // Commander depuis le cumul des prévisions : retour aux Prévisions.
  'cash/commandes/nouvelle': { type: 'formulaire', parent: '/cash/commandes', origines: { previsions: '/previsions' } },
  'cash/commandes/receptions': {
    type: 'fiche',
    parent: listeCommandes,
    origines: { 'a-receptionner': A_RECEPTIONNER },
  },
  // Dépenses, Reversements, Clôtures : ouverts depuis l'onglet Moi, qui est leur parent.
  'cash/depenses/index': { type: 'liste', parent: '/profil' },
  'cash/depenses/nouvelle': { type: 'formulaire', parent: '/cash/depenses' },
  'cash/reversements/index': { type: 'liste', parent: '/profil' },
  'cash/reversements/historique': { type: 'liste', parent: '/cash/reversements' },
  'cash/reversements/nouveau': { type: 'formulaire', parent: '/cash/reversements' },

  'stock/index': { type: 'liste', parent: ACCUEIL },
  'stock/mouvements': { type: 'liste', parent: '/stock' },
  'stock/equipe': { type: 'liste', parent: '/stock' },
  // Ouverte depuis Notifications (« Transferts à recevoir ») : retour à Notifications.
  // Depuis les Notifications du responsable : retour à celles-ci. Responsable
  // (ouverte depuis Moi ou par un lien) : parent Moi, pile [Transferts] seule.
  'stock/transferts/index': {
    type: 'liste',
    parent: parentTransferts,
    origines: { notifications: NOTIFICATIONS_LIVREUR, 'notifications-responsable': NOTIFICATIONS_RESPONSABLE },
  },
  'stock/transferts/nouveau': { type: 'formulaire', parent: '/stock/transferts' },
  // Organisation (O8) : demandes de chargement du commercial, ouvertes depuis Stock.
  'stock/demandes/index': { type: 'liste', parent: '/stock', origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'stock/demandes/nouvelle': { type: 'formulaire', parent: '/stock/demandes' },

  'previsions/index': { type: 'liste', parent: ACCUEIL },
  'previsions/nouvelle': { type: 'formulaire', parent: '/previsions' },
  // Cloche de l'Accueil : écran Notifications (À traiter, puis fil N8). Les écrans
  // ouverts par une notification (`depuis: notifications`) y reviennent.
  'previsions/echues': { type: 'liste', parent: ACCUEIL },

  'clotures/index': { type: 'liste', parent: '/profil', origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'clotures/nouvelle': { type: 'formulaire', parent: '/clotures' },

  'profil/index': { type: 'liste', parent: ACCUEIL },
  'profil/infos': { type: 'formulaire', parent: '/profil' },
  'profil/password': { type: 'formulaire', parent: '/profil' },
  'profil/prix': { type: 'formulaire', parent: '/profil' },
  'profil/fournisseurs': { type: 'liste', parent: '/profil', origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'profil/fournisseur-commandes': { type: 'liste', parent: '/profil/fournisseurs' },
  // M1 : ouverte par la notification « Mot de passe demandé » ou la ligne « À traiter ».
  'profil/apprentis/index': {
    type: 'liste',
    parent: '/profil',
    origines: { notifications: NOTIFICATIONS_LIVREUR, 'notifications-responsable': NOTIFICATIONS_RESPONSABLE },
  },
  'profil/apprentis/[id]': { type: 'fiche', parent: '/profil/apprentis' },
  'profil/apprentis/nouveau': { type: 'formulaire', parent: '/profil/apprentis' },
  // P8 : réaffectation des clients par le livreur principal indépendant, ouverte depuis
  // « Mes apprentis » ou « Mes clients » (retour à la liste des clients).
  'profil/apprentis/reaffecter': { type: 'formulaire', parent: '/profil/apprentis', origines: { clients: '/clients' } },
  'profil/apprentis/reaffectations': { type: 'liste', parent: '/profil/apprentis/reaffecter' },
  'profil/etats/index': { type: 'liste', parent: '/profil' },
  'profil/etats/[famille]': { type: 'fiche', parent: '/profil/etats' },
  // Organisation (O17) : « Mes factures » (factures et avoirs) du commercial.
  'profil/factures': { type: 'liste', parent: '/profil' },
  // Remises d'argent : « Mes remises » (apprenti), « Remises des apprentis » (principal).
  'profil/remises/index': { type: 'liste', parent: '/profil', origines: { notifications: NOTIFICATIONS_LIVREUR } },
  'profil/remises/nouvelle': { type: 'formulaire', parent: '/profil/remises' },
  // Ouverte depuis la fiche apprenti (liste filtrée sur lui) : retour à la fiche.
  'profil/remises-apprentis': {
    type: 'liste',
    parent: '/profil',
    origines: {
      apprenti: '/profil/apprentis/[apprentiId]',
      notifications: NOTIFICATIONS_LIVREUR,
      'notifications-responsable': NOTIFICATIONS_RESPONSABLE,
    },
  },

  // Localisation sur demande : Localiser (ouvert depuis Moi ou « Mes apprentis ») et l'écran
  // de réponse de la cible (notification, bandeau de l'accueil).
  localiser: { type: 'liste', parent: '/profil' },
  'localisation/[id]': { type: 'fiche', parent: ACCUEIL, origines: { notifications: NOTIFICATIONS_LIVREUR } },
};

/**
 * Dossiers qui ont leur propre `_layout` (pile imbriquée). Les onglets
 * (premier segment) sont des piles du navigateur d'onglets `(livreur)`.
 */
export const PILES_IMBRIQUEES: ReadonlySet<string> = new Set([
  'cash/commandes',
  'cash/depenses',
  'cash/reversements',
  'clients/nouveau',
  'profil/apprentis',
  'profil/etats',
  'profil/remises',
  'stock/transferts',
  'stock/demandes',
]);

/** Nom de la route du groupe des écrans du livreur dans la pile racine. */
export const GROUPE_LIVREUR = '(livreur)';

// ---------------------------------------------------------------------------
// Chemins
// ---------------------------------------------------------------------------

export interface Cible {
  /** Fichier de l'écran (clé de `ROUTES`). */
  fichier: string;
  /** Paramètres de l'écran : segments dynamiques et paramètres de requête. */
  params: Parametres;
}

/** Chemin d'URL d'un fichier (sans `index` final), avec ses segments dynamiques. */
function motif(fichier: string): string[] {
  const s = fichier.split('/');
  if (s[s.length - 1] === 'index') s.pop();
  return s;
}

/** Chemin concret d'un fichier : `[id]` remplacé par le paramètre, `/` en tête. */
export function cheminDe(fichier: string, params: Parametres = {}): string {
  const segments = motif(fichier).map((seg) => {
    const m = /^\[(.+)\]$/.exec(seg);
    return m ? encodeURIComponent(params[m[1]] ?? seg) : seg;
  });
  return `/${segments.join('/')}`;
}

/**
 * Découpe un href de l'app (`/(livreur)/cash/commandes/[id]?x=1`, ou
 * `/cash/commandes/42`) en chemin sans groupe ni requête, segments
 * dynamiques remplis par `params`, et paramètres de requête.
 */
export function normaliserHref(
  href: string,
  params: Record<string, string | number | undefined> = {},
): { chemin: string; requete: Parametres } {
  const [brut, query = ''] = href.split('?');
  const p: Parametres = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) p[k] = String(v);
  const utilises = new Set<string>();
  const segments = brut
    .split('/')
    .filter((s) => s && !/^\(.*\)$/.test(s))
    .map((seg) => {
      const m = /^\[(.+)\]$/.exec(seg);
      if (m && p[m[1]] !== undefined) {
        utilises.add(m[1]);
        return encodeURIComponent(p[m[1]]);
      }
      return seg;
    });
  const requete: Parametres = {};
  for (const morceau of query.split('&').filter(Boolean)) {
    const [k, v = ''] = morceau.split('=');
    requete[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  for (const [k, v] of Object.entries(p)) if (!utilises.has(k)) requete[k] = v;
  return { chemin: `/${segments.join('/')}`, requete };
}

/**
 * Écran correspondant à un chemin concret (`/clients/abc` →
 * `clients/[id]/index` avec `{ id: 'abc' }`). Les segments fixes priment sur
 * les segments dynamiques (`/clients/map` n'est pas une fiche client).
 */
export function trouverRoute(chemin: string): Cible | null {
  const segments = chemin.split('/').filter(Boolean);
  let meilleur: { cible: Cible; fixes: number } | null = null;
  for (const fichier of Object.keys(ROUTES)) {
    const m = motif(fichier);
    if (m.length !== segments.length) continue;
    const params: Parametres = {};
    let fixes = 0;
    let ok = true;
    for (let i = 0; i < m.length; i++) {
      const dyn = /^\[(.+)\]$/.exec(m[i]);
      if (dyn) params[dyn[1]] = decodeURIComponent(segments[i]);
      else if (m[i] === segments[i]) fixes++;
      else {
        ok = false;
        break;
      }
    }
    if (ok && (!meilleur || fixes > meilleur.fixes)) meilleur = { cible: { fichier, params }, fixes };
  }
  return meilleur?.cible ?? null;
}

/** Onglet (route du navigateur d'onglets) d'un écran. */
export function ongletDe(fichier: string): string {
  return fichier.split('/')[0];
}

/**
 * Parent logique d'un écran : chemin concret, `ACCUEIL`, ou null pour
 * l'Accueil lui-même. Un écran inconnu remonte à l'Accueil.
 */
/**
 * Parent donné par l'origine (`depuis`) de l'écran, s'il en a une valide :
 * valeur admise par la table, gabarit entièrement rempli, écran connu.
 */
export function parentOrigine(cible: Cible): string | null {
  const depuis = cible.params.depuis;
  const origines = ROUTES[cible.fichier]?.origines;
  // Propriété propre seulement : `constructor`, `__proto__`, `toString`… sont refusés.
  const gabarit =
    typeof depuis === 'string' && origines && Object.prototype.hasOwnProperty.call(origines, depuis)
      ? origines[depuis as Origine]
      : undefined;
  if (typeof gabarit !== 'string') return null;
  const { chemin } = normaliserHref(gabarit, cible.params);
  if (chemin.includes('[') || !trouverRoute(chemin)) return null;
  return chemin;
}

export function parentDe(cible: Cible, ctx: ContexteNavigation): string | null {
  const route = ROUTES[cible.fichier];
  if (!route) return ACCUEIL;
  if (route.parent === null) return null;
  const origine = parentOrigine(cible);
  if (origine) return origine;
  const parent = typeof route.parent === 'function' ? route.parent(ctx) : route.parent;
  return normaliserHref(parent, cible.params).chemin;
}

/**
 * Pile propre d'un écran : la chaîne de ses parents restés dans la même
 * rubrique (onglet), du plus haut à l'écran lui-même.
 */
export function chaineOuverture(cible: Cible, ctx: ContexteNavigation): Cible[] {
  const chaine: Cible[] = [cible];
  const onglet = ongletDe(cible.fichier);
  let courant = cible;
  for (let garde = 0; garde < 10; garde++) {
    const parent = parentDe(courant, ctx);
    if (!parent || parent === ACCUEIL) break;
    const p = trouverRoute(parent);
    if (!p || ongletDe(p.fichier) !== onglet) break;
    chaine.unshift(p);
    courant = p;
  }
  return chaine;
}

// ---------------------------------------------------------------------------
// États de navigation (sous-ensemble de React Navigation)
// ---------------------------------------------------------------------------

export interface RouteEtat {
  key?: string;
  name: string;
  params?: object;
  state?: EtatNavigateur | PartielNavigateur;
}

export interface EtatNavigateur {
  key: string;
  index: number;
  routes: RouteEtat[];
  stale?: false;
  type?: string;
  routeNames?: string[];
  history?: Array<{ type: string; key: string }>;
  [autre: string]: unknown;
}

export interface PartielNavigateur {
  index?: number;
  routes: RouteEtat[];
}

export type ActionOnglets =
  | { type: 'RESET'; payload: EtatNavigateur; target: string }
  | { type: 'JUMP_TO'; payload: { name: string }; target: string };

/** Paramètres d'écran en chaînes (on ignore `screen`/`params` posés par expo-router sur un parent). */
function paramsEcran(params: object | undefined): Parametres {
  const p: Parametres = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === 'screen' || k === 'params' || k === 'initial' || k === 'state') continue;
    if (typeof v === 'string' || typeof v === 'number') p[k] = String(v);
  }
  return p;
}

/** État du navigateur d'onglets du livreur dans l'état racine, ou undefined. */
export function trouverOnglets(etat: EtatNavigateur | PartielNavigateur | undefined): EtatNavigateur | undefined {
  if (!etat?.routes) return undefined;
  for (const r of etat.routes) {
    if (r.name === GROUPE_LIVREUR && r.state && 'key' in r.state) return r.state as EtatNavigateur;
    const sous = trouverOnglets(r.state);
    if (sous) return sous;
  }
  return undefined;
}

/** Une entrée de pile d'onglet aplatie : chemin de l'écran et sa position. */
interface EntreePile {
  chemin: string;
  /** Index dans la pile de l'onglet. */
  i: number;
  /** Index dans la pile imbriquée, ou -1. */
  j: number;
}

/** Écrans d'une pile d'onglet, du bas vers le haut, avec leur chemin. */
function aplatir(onglet: RouteEtat): EntreePile[] {
  const pile = onglet.state;
  if (!pile?.routes) return [{ chemin: cheminDe(onglet.name, paramsEcran(onglet.params)), i: 0, j: -1 }];
  const entrees: EntreePile[] = [];
  pile.routes.forEach((r, i) => {
    const dossier = `${onglet.name}/${r.name}`;
    if (PILES_IMBRIQUEES.has(dossier)) {
      const internes = r.state?.routes ?? [{ name: 'index', params: undefined }];
      internes.forEach((x, j) =>
        entrees.push({ chemin: cheminDe(`${dossier}/${x.name}`, paramsEcran(x.params)), i, j }),
      );
    } else {
      entrees.push({ chemin: cheminDe(dossier, paramsEcran(r.params)), i, j: -1 });
    }
  });
  return entrees;
}

/**
 * Écran affiché : onglet actif et route la plus profonde. Undefined si
 * l'état est inconnu.
 */
export function ecranActif(onglets: EtatNavigateur | undefined): (Cible & { chemin: string }) | undefined {
  const onglet = onglets?.routes?.[onglets.index];
  if (!onglet) return undefined;
  const noms = [onglet.name];
  let route: RouteEtat = onglet;
  let params = paramsEcran(route.params);
  for (let garde = 0; garde < 10; garde++) {
    const s = route.state;
    if (s?.routes?.length) {
      route = s.routes[s.index ?? s.routes.length - 1];
      noms.push(route.name);
      params = paramsEcran(route.params);
      continue;
    }
    // Pile pas encore montée : expo-router a posé l'écran visé dans les paramètres.
    const p = route.params as { screen?: unknown; params?: object } | undefined;
    if (typeof p?.screen !== 'string') break;
    noms.push(p.screen);
    params = paramsEcran(p.params);
    route = { name: p.screen, params: p.params };
  }
  const fichier = noms.join('/');
  const connu = ROUTES[fichier] ? fichier : ROUTES[`${fichier}/index`] ? `${fichier}/index` : fichier;
  return { fichier: connu, params, chemin: cheminDe(connu, params) };
}

/** Écrans d'une pile d'onglet (fichier et paramètres), du bas vers le haut. */
function ecransDePile(onglet: RouteEtat): Cible[] {
  const pile = onglet.state;
  if (!pile?.routes) return [];
  const out: Cible[] = [];
  for (const r of pile.routes) {
    const dossier = `${onglet.name}/${r.name}`;
    if (PILES_IMBRIQUEES.has(dossier)) {
      if (!r.state?.routes) return [];
      for (const x of r.state.routes) out.push({ fichier: `${dossier}/${x.name}`, params: paramsEcran(x.params) });
    } else out.push({ fichier: dossier, params: paramsEcran(r.params) });
  }
  return out;
}

/** Vrai si la pile de l'onglet est exactement la chaîne demandée. */
function pileIdentique(onglet: RouteEtat, chaine: Cible[]): boolean {
  const actuelle = ecransDePile(onglet);
  const cle = (c: Cible) => `${c.fichier}?${JSON.stringify(Object.entries(c.params).sort())}`;
  return actuelle.length === chaine.length && actuelle.every((c, i) => cle(c) === cle(chaine[i]));
}

/** Pile (partielle) d'un onglet pour une chaîne d'écrans de cet onglet. */
export function pileDe(chaine: Cible[]): PartielNavigateur {
  const routes: RouteEtat[] = [];
  for (const c of chaine) {
    const [onglet, ...reste] = c.fichier.split('/');
    const dossier = `${onglet}/${reste[0]}`;
    const params = Object.keys(c.params).length ? c.params : undefined;
    if (reste.length > 1 && PILES_IMBRIQUEES.has(dossier)) {
      const interne: RouteEtat = { name: reste.slice(1).join('/'), params };
      const dernier = routes[routes.length - 1];
      if (dernier?.name === reste[0] && dernier.state) {
        dernier.state.routes.push(interne);
        dernier.state.index = dernier.state.routes.length - 1;
      } else {
        routes.push({ name: reste[0], state: { index: 0, routes: [interne] } });
      }
    } else {
      routes.push({ name: reste.join('/'), params });
    }
  }
  return { index: routes.length - 1, routes };
}

/** Onglets avec `nom` actif et, si fournie, sa pile remplacée. */
function avecOnglet(onglets: EtatNavigateur, nom: string, pile?: RouteEtat['state']): EtatNavigateur | null {
  const index = onglets.routes.findIndex((r) => r.name === nom);
  if (index < 0) return null;
  const cle = onglets.routes[index].key;
  const routes = onglets.routes.map((r, i) =>
    i === index && pile ? { key: r.key, name: r.name, state: pile } : r,
  );
  const history = onglets.history
    ? [...onglets.history.filter((h) => h.key !== cle), { type: 'route', key: cle as string }]
    : undefined;
  return { ...onglets, index, routes, ...(history ? { history } : {}) };
}

/**
 * Ouvrir un écran sur une pile propre : la pile de sa rubrique devient la
 * chaîne de ses parents dans la rubrique, et la rubrique est affichée.
 * Null si l'écran est inconnu (le routeur prend le relais).
 */
export function actionOuvrir(
  onglets: EtatNavigateur,
  href: string,
  params: Record<string, string | number | undefined> | undefined,
  ctx: ContexteNavigation,
): ActionOnglets | null {
  const { chemin, requete } = normaliserHref(href, params);
  if (chemin === ACCUEIL) return { type: 'JUMP_TO', payload: { name: 'index' }, target: onglets.key };
  const cible = trouverRoute(chemin);
  if (!cible) return null;
  const nom = ongletDe(cible.fichier);
  // Onglet d'un seul écran (Notifications du responsable) : pas de pile, on l'affiche.
  if (cible.fichier === nom) {
    if (!onglets.routes.some((r) => r.name === nom)) return null;
    return onglets.routes[onglets.index]?.name === nom
      ? null
      : { type: 'JUMP_TO', payload: { name: nom }, target: onglets.key };
  }
  const chaine = chaineOuverture({ ...cible, params: { ...cible.params, ...requete } }, ctx);
  // Pile déjà identique (mêmes écrans, mêmes paramètres) : pas de RESET, qui
  // remonterait l'écran (recherche et défilement perdus) ; on affiche l'onglet.
  const onglet = onglets.routes.find((r) => r.name === nom);
  if (onglet && pileIdentique(onglet, chaine)) {
    return onglets.routes[onglets.index]?.name === nom ? null : { type: 'JUMP_TO', payload: { name: nom }, target: onglets.key };
  }
  const etat = avecOnglet(onglets, nom, pileDe(chaine));
  return etat ? { type: 'RESET', payload: etat, target: onglets.key } : null;
}

/**
 * Revenir à un écran (retour ou après enregistrement) : Accueil → onglet
 * Accueil ; écran déjà présent plus bas dans la pile de la rubrique → pile
 * dépilée jusqu'à lui (son état est conservé) ; sinon pile propre (`actionOuvrir`).
 */
export function actionRevenirA(
  onglets: EtatNavigateur,
  href: string,
  ctx: ContexteNavigation,
): ActionOnglets | null {
  const { chemin } = normaliserHref(href);
  if (chemin === ACCUEIL) return { type: 'JUMP_TO', payload: { name: 'index' }, target: onglets.key };
  const cible = trouverRoute(chemin);
  if (!cible) return null;
  const nom = ongletDe(cible.fichier);
  const onglet = onglets.routes.find((r) => r.name === nom);
  const actif = onglets.routes[onglets.index]?.name === nom;
  const pile = onglet?.state;
  if (onglet && pile && 'key' in pile) {
    const entrees = aplatir(onglet);
    // Rubrique affichée : le plus haut sous l'écran courant (pas lui-même) ;
    // autre rubrique (ex. retour à la fiche client) : sa pile est dépilée
    // jusqu'à l'écran, qui garde son état, et la rubrique est affichée.
    for (let k = entrees.length - (actif ? 2 : 1); k >= 0; k--) {
      const e = entrees[k];
      if (e.chemin !== chemin) continue;
      const routes = pile.routes.slice(0, e.i + 1).map((r, i) => {
        if (i !== e.i || e.j < 0 || !r.state) return r;
        return { ...r, state: { ...r.state, index: e.j, routes: r.state.routes.slice(0, e.j + 1) } };
      });
      const etat = avecOnglet(onglets, nom, { ...pile, index: e.i, routes });
      return etat ? { type: 'RESET', payload: etat, target: onglets.key } : null;
    }
  }
  return actionOuvrir(onglets, href, undefined, ctx);
}

/**
 * Retour depuis l'écran affiché : vers son parent logique. Null sur
 * l'Accueil (comportement par défaut : quitter l'application) ou si l'état
 * est inconnu.
 */
export function actionRetour(onglets: EtatNavigateur | undefined, ctx: ContexteNavigation): ActionOnglets | null {
  const ecran = ecranActif(onglets);
  if (!onglets || !ecran) return null;
  const parent = parentDe(ecran, ctx);
  if (parent === null) return null;
  return actionRevenirA(onglets, parent, ctx);
}

/**
 * Aller vers un écran depuis un écran de l'app : autre rubrique → pile
 * propre (`actionOuvrir`) ; même rubrique et écran déjà dans la pile →
 * dépilé (`actionRevenirA`, pas de doublon) ; sinon 'push' (empilé sur
 * l'écran courant, ex. liste → fiche → formulaire).
 */
export function actionNaviguer(
  onglets: EtatNavigateur,
  href: string,
  params: Record<string, string | number | undefined> | undefined,
  ctx: ContexteNavigation,
): ActionOnglets | 'push' | null {
  const { chemin, requete } = normaliserHref(href, params);
  if (chemin === ACCUEIL) return actionOuvrir(onglets, href, params, ctx);
  const cible = trouverRoute(chemin);
  if (!cible) return 'push';
  const nom = ongletDe(cible.fichier);
  const onglet = onglets.routes[onglets.index];
  if (onglet?.name !== nom) return actionOuvrir(onglets, href, params, ctx);
  const actif = ecranActif(onglets);
  if (actif?.chemin === chemin && Object.keys(requete).length === 0) return null;
  const present = aplatir(onglet).slice(0, -1).some((e) => e.chemin === chemin);
  if (present && Object.keys(requete).length === 0) return actionRevenirA(onglets, href, ctx);
  return 'push';
}

// ---------------------------------------------------------------------------
// Espace fournisseur (F1, F2) : onglets Accueil, Commandes, Livreurs, Argent, Moi
// ---------------------------------------------------------------------------

/** Notifications du fournisseur (cloche de l'Accueil, entrée de Moi). */
export const NOTIFICATIONS_FOURNISSEUR = '/fournisseur/notifications';

/**
 * Écrans du fournisseur, par fichier (relatif à `app/fournisseur`, sans
 * extension) → type et parent (chemin complet, `/fournisseur/…`). Chaque
 * fichier d'écran doit y figurer (test). Même règle que le livreur : fiche
 * ou formulaire → sa liste, liste (racine d'onglet) → Accueil. Une origine
 * (`origines`, paramètre `depuis`) peut changer le parent d'un écran
 * (`parentFournisseur` avec les paramètres de l'écran).
 */
export const ROUTES_FOURNISSEUR: Readonly<Record<string, RouteApp>> = {
  index: { type: 'accueil', parent: null },
  // Cloche de l'Accueil, ou entrée « Notifications » de Moi (onglet masqué).
  notifications: { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
  // Racines des onglets (Commandes, Livreurs ; FM3 : Argent).
  'commandes/index': { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
  // FM2 : détail d'une commande reçue (liste, notification « commande reçue »).
  'commandes/[id]': { type: 'fiche', parent: '/fournisseur/commandes' },
  'livreurs/index': { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
  // FM2 : invitations (bouton de la liste, « À traiter », notification) et fiche d'un livreur partenaire.
  'livreurs/invitations': { type: 'liste', parent: '/fournisseur/livreurs' },
  'livreurs/[id]/index': { type: 'fiche', parent: '/fournisseur/livreurs' },
  'livreurs/[id]/commandes/index': { type: 'liste', parent: '/fournisseur/livreurs/[id]' },
  'livreurs/[id]/commandes/[commandeId]': { type: 'fiche', parent: '/fournisseur/livreurs/[id]/commandes' },
  'livreurs/[id]/prix': { type: 'formulaire', parent: '/fournisseur/livreurs/[id]' },
  'livreurs/[id]/versement': { type: 'formulaire', parent: '/fournisseur/livreurs/[id]' },
  'argent/index': { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
  // FM3 : versements reçus (et leurs demandes de modification), reversements, dépenses.
  'argent/versements/index': { type: 'liste', parent: '/fournisseur/argent' },
  'argent/versements/nouveau': { type: 'formulaire', parent: '/fournisseur/argent/versements' },
  'argent/versements/demandes': { type: 'liste', parent: '/fournisseur/argent/versements' },
  'argent/versements/modifier': { type: 'formulaire', parent: '/fournisseur/argent/versements' },
  'argent/reversements': { type: 'liste', parent: '/fournisseur/argent' },
  'argent/depenses/index': { type: 'liste', parent: '/fournisseur/argent' },
  'argent/depenses/nouvelle': { type: 'formulaire', parent: '/fournisseur/argent/depenses' },
  'moi/index': { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
  'moi/infos': { type: 'formulaire', parent: '/fournisseur/moi' },
  'moi/password': { type: 'formulaire', parent: '/fournisseur/moi' },
  'moi/depot': { type: 'formulaire', parent: '/fournisseur/moi' },
  // FM3 : catalogue (Moi) ; « ajouter » est plus précis que [id].
  'moi/catalogue/index': { type: 'liste', parent: '/fournisseur/moi' },
  'moi/catalogue/ajouter': { type: 'formulaire', parent: '/fournisseur/moi/catalogue' },
  'moi/catalogue/[id]': { type: 'formulaire', parent: '/fournisseur/moi/catalogue' },
  // Commis du fournisseur : Mes commis (Moi) et sa création.
  'moi/commis/index': { type: 'liste', parent: '/fournisseur/moi' },
  'moi/commis/nouveau': { type: 'formulaire', parent: '/fournisseur/moi/commis' },
  // Mes clients (Argent) : fiche (sorties, versements, dû), prix, versement, modification ; « nouveau » est plus précis que [id].
  'argent/clients/index': { type: 'liste', parent: '/fournisseur/argent' },
  'argent/clients/nouveau': { type: 'formulaire', parent: '/fournisseur/argent/clients' },
  'argent/clients/[id]/index': { type: 'fiche', parent: '/fournisseur/argent/clients' },
  'argent/clients/[id]/modifier': { type: 'formulaire', parent: '/fournisseur/argent/clients/[id]' },
  'argent/clients/[id]/prix': { type: 'formulaire', parent: '/fournisseur/argent/clients/[id]' },
  'argent/clients/[id]/versement': { type: 'formulaire', parent: '/fournisseur/argent/clients/[id]' },
  // Récapitulatif des remises : depuis l'Accueil ou Livreurs (onglet masqué).
  recapitulatif: { type: 'liste', parent: ACCUEIL_FOURNISSEUR },
};

/** Vrai pour un chemin d'un espace (`/fournisseur`, `/fournisseur/…`). */
function estCheminDeLEspace(racine: string, chemin: string): boolean {
  const { chemin: c } = normaliserHref(chemin);
  return c === racine || c.startsWith(`${racine}/`);
}

/** Écran d'un espace (fournisseur, commis) correspondant à un chemin concret ; les segments fixes priment. */
function trouverRouteDeLEspace(racine: string, table: Readonly<Record<string, RouteApp>>, chemin: string): Cible | null {
  const { chemin: c } = normaliserHref(chemin);
  if (!estCheminDeLEspace(racine, c)) return null;
  const segments = c.split('/').filter(Boolean).slice(1);
  let meilleur: { cible: Cible; fixes: number } | null = null;
  for (const fichier of Object.keys(table)) {
    const m = motif(fichier);
    if (m.length !== segments.length) continue;
    const params: Parametres = {};
    let fixes = 0;
    let ok = true;
    for (let i = 0; i < m.length; i++) {
      const dyn = /^\[(.+)\]$/.exec(m[i]);
      if (dyn) params[dyn[1]] = decodeURIComponent(segments[i]);
      else if (m[i] === segments[i]) fixes++;
      else {
        ok = false;
        break;
      }
    }
    if (ok && (!meilleur || fixes > meilleur.fixes)) meilleur = { cible: { fichier, params }, fixes };
  }
  return meilleur?.cible ?? null;
}

/** Parent logique d'un écran d'un espace (chemin complet) ; null pour son Accueil, son Accueil pour un écran inconnu. */
function parentDansLEspace(
  racine: string,
  table: Readonly<Record<string, RouteApp>>,
  chemin: string,
  params: Parametres,
): string | null {
  const cible = trouverRouteDeLEspace(racine, table, chemin);
  if (!cible) return racine;
  const p = { ...cible.params, ...normaliserHref(chemin).requete, ...params };
  const route = table[cible.fichier];
  if (route.parent === null) return null;
  const depuis = p.depuis;
  const origine =
    typeof depuis === 'string' && route.origines && Object.prototype.hasOwnProperty.call(route.origines, depuis)
      ? route.origines[depuis as Origine]
      : undefined;
  const gabarit = origine ?? (typeof route.parent === 'function' ? route.parent({ apprenti: false }) : route.parent);
  const { chemin: parent } = normaliserHref(gabarit, p);
  return parent.includes('[') ? racine : parent;
}

/** Vrai pour un chemin de l'espace fournisseur (`/fournisseur`, `/fournisseur/…`). */
export function estCheminFournisseur(chemin: string): boolean {
  return estCheminDeLEspace(ACCUEIL_FOURNISSEUR, chemin);
}

/** Écran du fournisseur correspondant à un chemin concret (`/fournisseur/commandes` → `commandes/index`). */
export function trouverRouteFournisseur(chemin: string): Cible | null {
  return trouverRouteDeLEspace(ACCUEIL_FOURNISSEUR, ROUTES_FOURNISSEUR, chemin);
}

/**
 * Parent logique d'un écran du fournisseur (chemin complet), d'après
 * `ROUTES_FOURNISSEUR` et son origine (`depuis`) ; null pour l'Accueil. Un
 * écran inconnu remonte à l'Accueil du fournisseur.
 */
export function parentFournisseur(chemin: string, params: Parametres = {}): string | null {
  return parentDansLEspace(ACCUEIL_FOURNISSEUR, ROUTES_FOURNISSEUR, chemin, params);
}

// ---------------------------------------------------------------------------
// Espace commis : onglets Commandes, Clients, Récap, Moi
// ---------------------------------------------------------------------------

/** Notifications du commis (cloche des Commandes, entrée de Moi). */
export const NOTIFICATIONS_COMMIS = '/commis/notifications';

/**
 * Écrans du commis, par fichier (relatif à `app/commis`, sans extension) →
 * type et parent (chemin complet, `/commis/…`). Chaque fichier d'écran doit
 * y figurer (test). Même règle que le fournisseur : fiche ou formulaire → sa
 * liste, liste (racine d'onglet) → Accueil (les Commandes).
 */
export const ROUTES_COMMIS: Readonly<Record<string, RouteApp>> = {
  // Onglet Commandes : les commandes à servir, filtrables par livreur.
  index: { type: 'accueil', parent: null },
  notifications: { type: 'liste', parent: ACCUEIL_COMMIS },
  // Détail d'une commande (remises, « Commande terminée ») et saisie d'une remise : l'identifiant est
  // dans le chemin, la remise remonte donc toujours à sa commande (flèche, retour Android, après l'envoi).
  'commandes/[id]/index': { type: 'fiche', parent: ACCUEIL_COMMIS },
  'commandes/[id]/remise': { type: 'formulaire', parent: '/commis/commandes/[id]' },
  'remise-sans-commande': { type: 'formulaire', parent: ACCUEIL_COMMIS },
  // Onglet Clients : clients, sorties du jour et saisie d'une sortie.
  'clients/index': { type: 'liste', parent: ACCUEIL_COMMIS },
  'clients/sortie': { type: 'formulaire', parent: '/commis/clients' },
  recapitulatif: { type: 'liste', parent: ACCUEIL_COMMIS },
  'moi/index': { type: 'liste', parent: ACCUEIL_COMMIS },
  'moi/password': { type: 'formulaire', parent: '/commis/moi' },
};

/** Vrai pour un chemin de l'espace commis (`/commis`, `/commis/…`). */
export function estCheminCommis(chemin: string): boolean {
  return estCheminDeLEspace(ACCUEIL_COMMIS, chemin);
}

/** Écran du commis correspondant à un chemin concret (`/commis/commandes/c1` → `commandes/[id]`). */
export function trouverRouteCommis(chemin: string): Cible | null {
  return trouverRouteDeLEspace(ACCUEIL_COMMIS, ROUTES_COMMIS, chemin);
}

/** Parent logique d'un écran du commis (chemin complet) ; null pour l'Accueil. */
export function parentCommis(chemin: string, params: Parametres = {}): string | null {
  return parentDansLEspace(ACCUEIL_COMMIS, ROUTES_COMMIS, chemin, params);
}
