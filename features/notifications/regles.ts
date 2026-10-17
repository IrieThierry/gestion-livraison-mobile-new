import type { NotificationResponse } from '../../types/api';
import { DEPUIS_NOTIFICATIONS, DEPUIS_NOTIFICATIONS_RESPONSABLE, estEcranResponsable, trouverRoute } from '../../lib/navigation';

/**
 * N8 : règles pures du fil de notifications (mobile) — heure relative,
 * groupes « Nouveau / Aujourd'hui / Plus tôt », mise en gras des noms,
 * apparence par type et traduction de la route logique du back en écran.
 */

/** Taille d'une page de `GET /notification/me`. */
export const TAILLE_PAGE_NOTIFICATIONS = 20;
/** Relecture du compteur et du fil (N8 f). */
export const INTERVALLE_NOTIFICATIONS_MS = 30_000;

export const TITRE_NOUVEAU = 'Nouveau';
export const TITRE_AUJOURDHUI = 'Aujourd’hui';
export const TITRE_PLUS_TOT = 'Plus tôt';

/** `yyyy-MM-ddTHH:mm:ss` (heure locale, sans fuseau) → Date ; null si illisible. */
export function lireDate(valeur: string | null | undefined): Date | null {
  if (!valeur) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(valeur);
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

const memeJour = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const p2 = (n: number) => String(n).padStart(2, '0');

/**
 * Heure relative : « à l'instant » (moins d'une minute, ou date future),
 * « il y a 5 min », « il y a 2 h » (moins de 24 h), « hier », puis la date
 * (jj/mm/aaaa).
 */
export function heureRelative(creeLe: string, maintenant: Date = new Date()): string {
  const d = lireDate(creeLe);
  if (!d) return '';
  const minutes = Math.floor((maintenant.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hier = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate() - 1);
  if (memeJour(d, hier)) return 'hier';
  if (minutes < 24 * 60) return `il y a ${Math.floor(minutes / 60)} h`;
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export interface GroupeNotifications {
  titre: string;
  elements: NotificationResponse[];
}

/**
 * Groupes du fil, dans l'ordre reçu (plus récent d'abord) : « Nouveau »
 * (non lues), « Aujourd'hui » (lues du jour), « Plus tôt » (lues plus
 * anciennes). Les groupes vides sont omis.
 */
export function grouperNotifications(
  elements: readonly NotificationResponse[],
  maintenant: Date = new Date(),
): GroupeNotifications[] {
  const nouveau: NotificationResponse[] = [];
  const aujourdhui: NotificationResponse[] = [];
  const plusTot: NotificationResponse[] = [];
  for (const n of elements) {
    if (!n.lue) nouveau.push(n);
    else {
      const d = lireDate(n.creeLe);
      (d && memeJour(d, maintenant) ? aujourdhui : plusTot).push(n);
    }
  }
  return [
    { titre: TITRE_NOUVEAU, elements: nouveau },
    { titre: TITRE_AUJOURDHUI, elements: aujourdhui },
    { titre: TITRE_PLUS_TOT, elements: plusTot },
  ].filter((g) => g.elements.length > 0);
}

/** Notifications des pages reçues, sans doublon (une page relue peut chevaucher la suivante). */
export function aplatirPages(pages: readonly (readonly NotificationResponse[])[] | undefined): NotificationResponse[] {
  const vus = new Set<string>();
  const out: NotificationResponse[] = [];
  for (const page of pages ?? []) {
    for (const n of page) {
      if (vus.has(n.id)) continue;
      vus.add(n.id);
      out.push(n);
    }
  }
  return out;
}

/** Curseur de la page suivante : id de la dernière reçue ; aucune si la page est incomplète. */
export function curseurSuivant(page: readonly NotificationResponse[], taille = TAILLE_PAGE_NOTIFICATIONS): string | undefined {
  return page.length < taille ? undefined : page[page.length - 1]?.id;
}

export interface Segment {
  texte: string;
  gras: boolean;
}

/** Références d'objets (TRF-3, REM-4, CMDE-5, DCH-2…). */
const REFERENCE = /\b[A-Z]{2,5}-\d+\b/g;

const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Phrase découpée pour l'affichage : le nom de l'auteur et les références
 * (« TRF-3 ») en gras, le reste normal.
 */
export function segmentsTexte(texte: string, noms: readonly (string | null | undefined)[] = []): Segment[] {
  const motifs = noms.filter((n): n is string => !!n && n.trim().length > 0).map(echapper);
  const re = new RegExp([...motifs, REFERENCE.source].join('|'), 'g');
  const out: Segment[] = [];
  let i = 0;
  for (const m of texte.matchAll(re)) {
    const debut = m.index ?? 0;
    if (m[0].length === 0) continue;
    if (debut > i) out.push({ texte: texte.slice(i, debut), gras: false });
    out.push({ texte: m[0], gras: true });
    i = debut + m[0].length;
  }
  if (i < texte.length) out.push({ texte: texte.slice(i), gras: false });
  return out;
}

export type DomaineNotification =
  | 'transfert'
  | 'remise'
  | 'versement'
  | 'commande'
  | 'chargement'
  | 'clients'
  | 'cloture'
  | 'relation'
  | 'compte'
  | 'autre';

export type TonNotification = 'positif' | 'negatif' | 'neutre';

const DOMAINE_PAR_CIBLE: Record<string, DomaineNotification> = {
  TRANSFERT: 'transfert',
  REMISE_ARGENT: 'remise',
  DEMANDE_MODIF_VERSEMENT: 'versement',
  COMMANDE: 'commande',
  DEMANDE_CHARGEMENT: 'chargement',
  CLIENTS: 'clients',
  CLOTURE: 'cloture',
  RELATION: 'relation',
};

const DOMAINE_PAR_PREFIXE: [string, DomaineNotification][] = [
  ['TRANSFERT_', 'transfert'],
  ['REMISE_', 'remise'],
  ['DEMANDE_MODIF_VERSEMENT_', 'versement'],
  ['COMMANDE_', 'commande'],
  ['DEMANDE_CHARGEMENT_', 'chargement'],
  ['CLIENTS_', 'clients'],
  ['CLOTURE_', 'cloture'],
  ['INVITATION_', 'relation'],
  ['MOT_DE_PASSE_', 'compte'],
];

/** Couleur de l'icône ronde : vert si accepté/confirmé, rouge si refusé/annulé, sinon celle du domaine. */
const COULEUR_DOMAINE: Record<DomaineNotification, string> = {
  transfert: '#2563eb',
  remise: '#d97706',
  versement: '#7c3aed',
  commande: '#ea580c',
  chargement: '#0891b2',
  clients: '#4f46e5',
  cloture: '#475569',
  relation: '#db2777',
  compte: '#047857',
  autre: '#64748b',
};
const COULEUR_POSITIF = '#065f46';
const COULEUR_NEGATIF = '#dc2626';

const POSITIFS = /_(ACCEPTE|ACCEPTEE|CONFIRMEE|APPROUVEE|LIVREE|RECEPTIONNEE|SERVIE)$/;
const NEGATIFS = /_(REFUSE|REFUSEE|CONTESTEE|REJETEE)$/;
const ANNULES = /_(ANNULE|ANNULEE)$/;
const COULEUR_ANNULE = '#64748b';
const COULEUR_RETIRES = '#d97706';

export interface Apparence {
  domaine: DomaineNotification;
  ton: TonNotification;
  couleur: string;
}

/** Icône (domaine) et couleur d'une notification d'après son type et sa cible. */
export function apparenceNotification(n: Pick<NotificationResponse, 'type' | 'cible'>): Apparence {
  const domaine =
    DOMAINE_PAR_CIBLE[n.cible?.type ?? ''] ??
    DOMAINE_PAR_PREFIXE.find(([p]) => n.type.startsWith(p))?.[1] ??
    'autre';
  const ton: TonNotification = POSITIFS.test(n.type) ? 'positif' : NEGATIFS.test(n.type) ? 'negatif' : 'neutre';
  const couleur =
    ton === 'positif'
      ? COULEUR_POSITIF
      : ton === 'negatif'
        ? COULEUR_NEGATIF
        : ANNULES.test(n.type)
          ? COULEUR_ANNULE
          : n.type === 'CLIENTS_RETIRES'
            ? COULEUR_RETIRES
            : COULEUR_DOMAINE[domaine];
  return { domaine, ton, couleur };
}

/** M1 : notification « <Nom> demande un nouveau mot de passe ». */
export const TYPE_MOT_DE_PASSE_DEMANDE = 'MOT_DE_PASSE_DEMANDE';

export interface ContexteCible {
  /** Apprenti : ses commandes sont celles à réceptionner. */
  apprenti: boolean;
  /** Responsable d'une organisation : seuls les écrans de son espace s'ouvrent. */
  responsable: boolean;
  /** F1 : compte fournisseur, les écrans s'ouvrent dans son espace (`/fournisseur/…`). */
  fournisseur?: boolean;
  /** Compte commis : les écrans s'ouvrent dans son espace (`/commis/…`). */
  commis?: boolean;
}

export interface CibleMobile {
  href: string;
  params: Record<string, string>;
}

/**
 * Écran mobile du livreur pour chacune des routes logiques du back. Null :
 * pas d'écran du livreur (routes `fournisseur.*` : `hrefFournisseur` ; demandes
 * de chargement du responsable : portail web).
 */
function hrefDeRoute(route: string, id: string | null, ctx: ContexteCible): string | null {
  switch (route) {
    case 'transferts.a-decider':
    case 'transferts':
      return '/(livreur)/stock/transferts';
    case 'remises.recues':
      return '/(livreur)/profil/remises-apprentis';
    case 'remises.mes-remises':
      return '/(livreur)/profil/remises';
    case 'versements.demandes-modif':
      return '/(livreur)/cash/versements/demandes';
    case 'commandes':
      if (id) return `/(livreur)/cash/commandes/${encodeURIComponent(id)}`;
      return ctx.apprenti ? '/(livreur)/cash/commandes/a-receptionner' : '/(livreur)/cash/commandes';
    case 'demandes-chargement':
      return '/(livreur)/stock/demandes';
    case 'clients':
      return '/(livreur)/clients';
    case 'clotures':
      return '/(livreur)/clotures';
    case 'fournisseurs':
      return '/(livreur)/profil/fournisseurs';
    // M1 « Mot de passe demandé » : liste des apprentis (ou des commerciaux).
    case 'equipe':
    case 'apprentis':
    case 'commerciaux':
    case 'organisation.commerciaux':
    case 'demandes-reinitialisation':
      return '/(livreur)/profil/apprentis';
    // Localisation : demande reçue → écran de réponse ; partagée ou refusée → Localiser.
    case 'localisation.demande':
      return id ? `/(livreur)/localisation/${encodeURIComponent(id)}` : null;
    case 'localisation':
      return '/(livreur)/localiser';
    // Espace fournisseur (hrefFournisseur) ; demandes de chargement du responsable : portail web.
    case 'fournisseur.commandes':
    case 'fournisseur.invitations':
    case 'commis.commandes':
    case 'organisation.demandes-chargement':
    default:
      return null;
  }
}

/**
 * F2 : écran de l'espace fournisseur de chaque route logique qui le concerne
 * (mêmes clés que le portail web : commandes reçues, invitations, demandes de
 * modification de versement). Null : pas d'écran (la notification est seulement
 * marquée lue). Commande reçue : son détail (la liste sans identifiant) ;
 * invitation : l'écran des invitations ; demandes de modification : leur
 * écran (Argent → Versements reçus).
 */
export function hrefFournisseur(route: string, id?: string | null): string | null {
  switch (route) {
    case 'fournisseur.commandes':
      return id ? `/fournisseur/commandes/${encodeURIComponent(id)}` : '/fournisseur/commandes';
    case 'fournisseur.invitations':
      return '/fournisseur/livreurs/invitations';
    case 'versements.demandes-modif':
      return '/fournisseur/argent/versements/demandes';
    // « Mot de passe demandé » d'un commis : la liste de ses commis (Moi → Mes commis).
    case 'equipe':
      return '/fournisseur/moi/commis';
    default:
      return null;
  }
}

/**
 * Écran de l'espace commis de chaque route logique qui le concerne : remise
 * refusée par le livreur (`commis.commandes`) → la commande, où la remise
 * refusée montre son motif ; sans identifiant, la liste des commandes. Null :
 * pas d'écran (la notification est seulement marquée lue).
 */
export function hrefCommis(route: string, id?: string | null): string | null {
  switch (route) {
    case 'commis.commandes':
      return id ? `/commis/commandes/${encodeURIComponent(id)}` : '/commis';
    default:
      return null;
  }
}

/**
 * Écran ouvert par l'appui sur une notification (avec `depuis` pour que le
 * retour ramène aux Notifications), ou null si aucun écran mobile ne lui
 * correspond (la notification est seulement marquée lue).
 */
export function cibleMobile(
  n: Pick<NotificationResponse, 'cible'> & Partial<Pick<NotificationResponse, 'type'>>,
  ctx: ContexteCible,
): CibleMobile | null {
  if (ctx.commis) {
    const lien = n.cible ? hrefCommis(n.cible.route, n.cible.id) : null;
    // Écran de l'espace : retour à son parent (ROUTES_COMMIS), sans origine.
    return lien ? { href: lien, params: {} } : null;
  }
  if (ctx.fournisseur) {
    const lien = n.cible ? hrefFournisseur(n.cible.route, n.cible.id) : null;
    // Écran de l'espace : retour à son parent (ROUTES_FOURNISSEUR), sans origine.
    return lien ? { href: lien, params: {} } : null;
  }
  // M1 : « Mot de passe demandé » ouvre toujours la liste des apprentis ou commerciaux.
  const href =
    n.type === TYPE_MOT_DE_PASSE_DEMANDE
      ? '/(livreur)/profil/apprentis'
      : n.cible
        ? hrefDeRoute(n.cible.route, n.cible.id, ctx)
        : null;
  if (!href) return null;
  if (ctx.responsable) {
    const route = trouverRoute(href.replace('/(livreur)', ''));
    if (!route || !estEcranResponsable(route.fichier)) return null;
  }
  return { href, params: { depuis: ctx.responsable ? DEPUIS_NOTIFICATIONS_RESPONSABLE : DEPUIS_NOTIFICATIONS } };
}

/** Texte du badge de la cloche (« 99+ » au-delà). */
export function badgeNonLues(n: number): string {
  return n > 99 ? '99+' : String(n);
}

/** Libellé accessible de la cloche : non lues, puis actions à traiter s'il y en a. */
export function libelleCloche(nonLues: number, aTraiter: number): string {
  const base = `Notifications : ${nonLues} non lue${nonLues > 1 ? 's' : ''}`;
  return aTraiter > 0 ? `${base}, ${aTraiter} à traiter` : base;
}
