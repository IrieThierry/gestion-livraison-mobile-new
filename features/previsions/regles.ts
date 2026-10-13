import type {
  ClientResponse,
  CumulProduitResponse,
  LivraisonResponse,
  PrevisionResponse,
  ProduitFournisseurResponse,
  ProduitResponse,
  UUID,
} from '../../types/api';
import { comparerDesignations } from '../../lib/tri';

/**
 * Règles des prévisions (fonctions pures, mêmes règles que le web) :
 * regroupement, Prévu / Livré / Reste / Écart, pastille, prévisions échues,
 * préremplissage d'une livraison et d'une commande fournisseur, « Plus tard ».
 * Toutes les dates sont des jours LOCAUX `yyyy-MM-dd`.
 */

// ---------------------------------------------------------------------------
// Jours
// ---------------------------------------------------------------------------

/** Jour local `yyyy-MM-dd` d'une date. */
export function jourLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/** Jour `yyyy-MM-dd` décalé de `n` jours (calendrier local, sans souci d'heure d'été). */
export function ajouterJours(jour: string, n: number): string {
  const [a, m, d] = jour.split('-').map(Number);
  return jourLocal(new Date(a, m - 1, d + n));
}

/**
 * Jour d'une date du back. Le back renvoie des dates locales sans fuseau
 * (`2026-10-13T00:00:00`) : la partie date est gardée telle quelle.
 */
export function jourDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  if (m) return m[1];
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : jourLocal(d);
}

const JOURS_ABREGES = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** `2026-10-13` → `mar. 13/10`. */
export function jourAbrege(jour: string): string {
  const [a, m, d] = jour.split('-').map(Number);
  const date = new Date(a, m - 1, d);
  return `${JOURS_ABREGES[date.getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}

/** `2026-10-13` → `13/10/2026`. */
export function jourCourt(jour: string | null | undefined): string {
  const j = jourDe(jour);
  if (!j) return '';
  const [a, m, d] = j.split('-');
  return `${d}/${m}/${a}`;
}

/** Libellé du bouton du formulaire : « Enregistrer pour le mar. 13/10 ». */
export function libelleEnregistrerPour(jour: string): string {
  return `Enregistrer pour le ${jourAbrege(jour)}`;
}

/**
 * Date de livraison prévue : obligatoire, pas dans le passé (aujourd'hui
 * autorisé). Message bloquant, ou null si la date est valide.
 */
export function erreurDatePrevue(jour: string | null | undefined, aujourdhui: string): string | null {
  if (!jour) return 'Choisis la date de livraison prévue.';
  if (jour < aujourdhui) return 'La date de livraison prévue ne peut pas être dans le passé.';
  return null;
}

// ---------------------------------------------------------------------------
// Prévu / Livré
// ---------------------------------------------------------------------------

export type StatutPrevision = 'A_LIVRER' | 'PARTIEL' | 'LIVRE';

export const LIBELLE_STATUT: Record<StatutPrevision, string> = {
  A_LIVRER: 'À livrer',
  PARTIEL: 'Partiel',
  LIVRE: 'Livré',
};

export interface PrevuLivre {
  prevu: number;
  livre: number;
  /** max(Prévu − Livré, 0). */
  reste: number;
  /** Livré − Prévu (négatif = manque, positif = livré en plus). */
  ecart: number;
  statut: StatutPrevision;
}

const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Prévu / Livré → Reste, Écart et pastille. */
export function prevuLivre(prevu: number, livre: number): PrevuLivre {
  const p = n(prevu);
  const l = n(livre);
  const statut: StatutPrevision = l <= 0 ? 'A_LIVRER' : l < p ? 'PARTIEL' : 'LIVRE';
  return { prevu: p, livre: l, reste: Math.max(p - l, 0), ecart: l - p, statut };
}

/** Clé d'un groupe (livreur, client, produit, jour). */
export function cleGroupe(livreurId: UUID, clientId: UUID, produitId: UUID, jour: string): string {
  return `${livreurId}|${clientId}|${produitId}|${jour}`;
}

/**
 * Quantités LIVRÉES (pas les retours) par (livreur, client, produit, jour de
 * la livraison).
 */
export function livreParCle(livraisons: readonly LivraisonResponse[]): Map<string, number> {
  const parCle = new Map<string, number>();
  for (const l of livraisons) {
    const jour = jourDe(l.date);
    const livreurId = l.livreur?.id;
    const clientId = l.client?.id;
    if (!jour || !livreurId || !clientId) continue;
    for (const p of l.produitsLivraison ?? []) {
      if (!p.produit?.id) continue;
      const cle = cleGroupe(livreurId, clientId, p.produit.id, jour);
      parCle.set(cle, (parCle.get(cle) ?? 0) + n(p.qteLivre));
    }
  }
  return parCle;
}

/** Prévisions d'un même (livreur, client, produit, jour) : une ligne, quantités sommées. */
export interface GroupePrevision extends PrevuLivre {
  cle: string;
  livreurId: UUID;
  livreurNom: string;
  client: ClientResponse;
  produit: ProduitResponse;
  jour: string;
  /** Identifiants des prévisions du groupe, la première d'abord (ordre reçu). */
  ids: UUID[];
  /** Premier commentaire non vide du groupe. */
  commentaire: string | null;
}

export function nomClient(c: Pick<ClientResponse, 'prenom' | 'nom'> | null | undefined): string {
  if (!c) return '';
  return `${c.prenom ?? ''} ${c.nom ?? ''}`.replace(/\s+/g, ' ').trim();
}

/**
 * Regroupe les prévisions par (livreur, client, produit, jour) et calcule
 * Prévu (Σ qteEstimee) / Livré (Σ qteLivre des livraisons de ce livreur à ce
 * client ce jour-là). Tri : client puis produit (ordre français).
 */
export function regrouperPrevisions(
  previsions: readonly PrevisionResponse[],
  livraisons: readonly LivraisonResponse[] = [],
): GroupePrevision[] {
  const livre = livreParCle(livraisons);
  const groupes = new Map<string, Omit<GroupePrevision, keyof PrevuLivre> & { prevu: number }>();
  for (const p of previsions) {
    const jour = jourDe(p.dateLivraison);
    const livreurId = p.livreur?.id;
    if (!jour || !livreurId || !p.client?.id || !p.produit?.id) continue;
    const cle = cleGroupe(livreurId, p.client.id, p.produit.id, jour);
    const g = groupes.get(cle);
    if (g) {
      g.prevu += n(p.qteEstimee);
      g.ids.push(p.id);
      if (!g.commentaire && p.commentaire) g.commentaire = p.commentaire;
    } else {
      groupes.set(cle, {
        cle,
        livreurId,
        livreurNom: nomClient(p.livreur),
        client: p.client,
        produit: p.produit,
        jour,
        ids: [p.id],
        commentaire: p.commentaire || null,
        prevu: n(p.qteEstimee),
      });
    }
  }
  return [...groupes.values()]
    .map((g) => ({ ...g, ...prevuLivre(g.prevu, livre.get(g.cle) ?? 0) }))
    .sort(
      (a, b) =>
        a.jour.localeCompare(b.jour) ||
        nomClient(a.client).localeCompare(nomClient(b.client), 'fr') ||
        (a.produit.designation ?? '').localeCompare(b.produit.designation ?? '', 'fr'),
    );
}

export interface BlocClient {
  clientId: UUID;
  client: ClientResponse;
  lignes: GroupePrevision[];
}

/** Lignes regroupées par client (ordre des lignes conservé). */
export function parClient(lignes: readonly GroupePrevision[]): BlocClient[] {
  const blocs = new Map<UUID, BlocClient>();
  for (const l of lignes) {
    const b = blocs.get(l.client.id) ?? { clientId: l.client.id, client: l.client, lignes: [] };
    b.lignes.push(l);
    blocs.set(l.client.id, b);
  }
  return [...blocs.values()];
}

export interface BlocLivreur {
  livreurId: UUID;
  livreurNom: string;
  lignes: GroupePrevision[];
}

/** Lignes regroupées par livreur (blocs apprentis), triés par nom. */
export function parLivreur(lignes: readonly GroupePrevision[]): BlocLivreur[] {
  const blocs = new Map<UUID, BlocLivreur>();
  for (const l of lignes) {
    const b = blocs.get(l.livreurId) ?? { livreurId: l.livreurId, livreurNom: l.livreurNom, lignes: [] };
    b.lignes.push(l);
    blocs.set(l.livreurId, b);
  }
  return [...blocs.values()].sort((a, b) => a.livreurNom.localeCompare(b.livreurNom, 'fr'));
}

// ---------------------------------------------------------------------------
// Échues
// ---------------------------------------------------------------------------

/** Échue = jour < aujourd'hui ET Reste > 0 (non livrée ou partielle). */
export function estEchue(g: Pick<GroupePrevision, 'jour' | 'reste'>, aujourdhui: string): boolean {
  return g.jour < aujourdhui && g.reste > 0;
}

/**
 * Nombre de jours passés lus pour trouver les prévisions échues (J−1 à J−N) :
 * le back ne liste les prévisions que jour par jour.
 */
export const JOURS_ECHUES = 7;

/** Jours passés lus pour les échues : J−1 … J−N (le plus récent d'abord). */
export function joursEchues(aujourdhui: string, nb: number = JOURS_ECHUES): string[] {
  return Array.from({ length: nb }, (_, i) => ajouterJours(aujourdhui, -(i + 1)));
}

/** Mémoire « Plus tard » : clé de groupe → jour où le choix a été fait. */
export type MemoirePlusTard = Record<string, string>;

/** Clé AsyncStorage de la mémoire « Plus tard », par utilisateur. */
export function cleStockagePlusTard(userId: UUID): string {
  return `GL_PREVISIONS_PLUS_TARD:${userId}`;
}

/** Un groupe mis « Plus tard » aujourd'hui n'est plus compté jusqu'au lendemain. */
export function estReporteePlusTard(memoire: MemoirePlusTard, cle: string, aujourdhui: string): boolean {
  return memoire[cle] === aujourdhui;
}

/** Ajoute des groupes à la mémoire (jour = aujourd'hui) et oublie les choix des jours passés. */
export function ajouterPlusTard(
  memoire: MemoirePlusTard,
  cles: readonly string[],
  aujourdhui: string,
): MemoirePlusTard {
  const suivante: MemoirePlusTard = {};
  for (const [k, v] of Object.entries(memoire)) if (v === aujourdhui) suivante[k] = v;
  for (const k of cles) suivante[k] = aujourdhui;
  return suivante;
}

/** Lecture tolérante de la mémoire stockée (JSON illisible ou absent : vide). */
export function lireMemoirePlusTard(brut: string | null | undefined): MemoirePlusTard {
  if (!brut) return {};
  try {
    const v: unknown = JSON.parse(brut);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const m: MemoirePlusTard = {};
    for (const [k, j] of Object.entries(v as Record<string, unknown>)) if (typeof j === 'string') m[k] = j;
    return m;
  } catch {
    return {};
  }
}

/** Échues à afficher et compter : échues, hors « Plus tard » du jour. */
export function echuesATraiter(
  groupes: readonly GroupePrevision[],
  memoire: MemoirePlusTard,
  aujourdhui: string,
): GroupePrevision[] {
  return groupes.filter((g) => estEchue(g, aujourdhui) && !estReporteePlusTard(memoire, g.cle, aujourdhui));
}

// ---------------------------------------------------------------------------
// Écritures (plans d'appels)
// ---------------------------------------------------------------------------

/** Commentaires réunis : `a · b` (b ignoré s'il est vide ou déjà contenu dans a). */
export function fusionnerCommentaires(a: string | null | undefined, b: string | null | undefined): string | null {
  const x = (a ?? '').trim();
  const y = (b ?? '').trim();
  if (!y) return x || null;
  if (!x) return y;
  if (x.includes(y)) return x;
  return `${x} · ${y}`;
}

/**
 * Création : ajouter à une prévision existante (PUT), créer (POST), ou rien
 * (`deja` : report déjà fait, voir `planReport`). `commentaire` absent = ne
 * pas toucher au commentaire existant.
 */
export type PlanCreation =
  | { type: 'ajout'; id: UUID; qteEstimee: number; commentaire?: string }
  | { type: 'creation'; qteEstimee: number; commentaire?: string }
  | { type: 'deja' };

type CibleGroupe = { livreurId: UUID; clientId: UUID; produitId: UUID; jour: string };

function duGroupe(p: PrevisionResponse, c: CibleGroupe): boolean {
  return (
    p.livreur?.id === c.livreurId &&
    p.client?.id === c.clientId &&
    p.produit?.id === c.produitId &&
    jourDe(p.dateLivraison) === c.jour
  );
}

/**
 * À la création, si une prévision existe déjà pour ce livreur + client +
 * produit + jour : la quantité est ajoutée à la première (PUT) au lieu de
 * créer un doublon ; un commentaire saisi est ajouté au sien (jamais écrasé).
 */
export function planCreation(
  existantes: readonly PrevisionResponse[],
  cible: CibleGroupe,
  qte: number,
  commentaire?: string | null,
): PlanCreation {
  const deja = existantes.find((p) => duGroupe(p, cible));
  const saisi = (commentaire ?? '').trim();
  if (!deja) {
    return saisi ? { type: 'creation', qteEstimee: qte, commentaire: saisi } : { type: 'creation', qteEstimee: qte };
  }
  const plan: PlanCreation = { type: 'ajout', id: deja.id, qteEstimee: n(deja.qteEstimee) + qte };
  const fusion = fusionnerCommentaires(deja.commentaire, saisi);
  return fusion && fusion !== (deja.commentaire ?? '').trim() ? { ...plan, commentaire: fusion } : plan;
}

/** Modification d'une ligne regroupée : la nouvelle quantité remplace le total. */
export interface PlanModification {
  /** `commentaire` : commentaire du groupe reporté sur la prévision gardée. */
  maj: { id: UUID; qteEstimee: number; commentaire?: string };
  suppressions: UUID[];
}

export function planModification(
  g: Pick<GroupePrevision, 'ids'> & { commentaire?: string | null },
  nouvelleQte: number,
): PlanModification {
  const [premiere, ...autres] = g.ids;
  const maj: PlanModification['maj'] = { id: premiere, qteEstimee: nouvelleQte };
  // Les autres prévisions sont supprimées : le commentaire du groupe (premier non vide) est gardé.
  if (g.commentaire && autres.length > 0) maj.commentaire = g.commentaire;
  return { maj, suppressions: autres };
}

/** Marque d'un report : `Reporté du 10/10` (jour d'origine). */
export function marqueReport(jourSource: string): string {
  const [, m, d] = jourSource.split('-');
  return `Reporté du ${d}/${m}`;
}

/**
 * Report d'une prévision échue (quantité = Reste) vers `jourCible`. Le back
 * ne modifie pas la date d'une prévision (PUT : quantité et commentaire
 * seulement) : on crée (ou on complète) la prévision du jour cible, marquée
 * « Reporté du JJ/MM » (ajoutée au commentaire existant), puis on supprime
 * les prévisions du groupe échu. Idempotent : si la cible porte déjà la
 * marque de ce jour d'origine (essai précédent interrompu avant la
 * suppression), rien n'est ajouté (`deja`) et seule la suppression est refaite.
 */
export interface PlanReport {
  creation: PlanCreation;
  cible: CibleGroupe;
  suppressions: UUID[];
}

export function planReport(
  g: Pick<GroupePrevision, 'ids' | 'reste' | 'livreurId' | 'client' | 'produit' | 'jour'> & {
    commentaire?: string | null;
  },
  jourCible: string,
  existantesCible: readonly PrevisionResponse[],
): PlanReport {
  const cible = { livreurId: g.livreurId, clientId: g.client.id, produitId: g.produit.id, jour: jourCible };
  const marque = marqueReport(g.jour);
  const suppressions = [...g.ids];
  if (existantesCible.some((p) => duGroupe(p, cible) && (p.commentaire ?? '').includes(marque))) {
    return { creation: { type: 'deja' }, cible, suppressions };
  }
  let creation = planCreation(existantesCible, cible, g.reste, marque);
  if (creation.type === 'creation') {
    creation = { ...creation, commentaire: fusionnerCommentaires(g.commentaire, marque) ?? marque };
  }
  return { creation, cible, suppressions };
}

// ---------------------------------------------------------------------------
// Préremplissages
// ---------------------------------------------------------------------------

export interface LignePrevue {
  produitId: UUID;
  designation: string;
  /** Reste à livrer (> 0). */
  qte: number;
}

/**
 * Livraison préremplie : prévisions du JOUR de ce livreur pour ce client,
 * quantité = Reste (rien si Reste = 0).
 */
export function lignesDepuisPrevisions(
  previsions: readonly PrevisionResponse[],
  livraisons: readonly LivraisonResponse[],
  cible: { livreurId: UUID; clientId: UUID; jour: string },
): LignePrevue[] {
  return regrouperPrevisions(
    previsions.filter(
      (p) =>
        p.livreur?.id === cible.livreurId &&
        p.client?.id === cible.clientId &&
        jourDe(p.dateLivraison) === cible.jour,
    ),
    livraisons,
  )
    .filter((g) => g.reste > 0)
    .map((g) => ({ produitId: g.produit.id, designation: g.produit.designation, qte: g.reste }))
    // P4 : le préremplissage garde l'ordre alphabétique.
    .sort((a, b) => comparerDesignations(a.designation, b.designation));
}

/** Commande préremplie depuis le cumul : quantités par produit proposé, produits non proposés à part. */
export interface PrefillCommande {
  /** produitId → quantité (texte, comme la saisie du formulaire). */
  quantites: Record<UUID, string>;
  nonProposes: Array<{ produitId: UUID; designation: string; qte: number }>;
}

export function prefillCommande(
  cumul: readonly CumulProduitResponse[],
  catalogue: readonly Pick<ProduitFournisseurResponse, 'produit'>[],
): PrefillCommande {
  const proposes = new Set(catalogue.map((c) => c.produit?.id).filter(Boolean));
  const quantites: Record<UUID, string> = {};
  const nonProposes: PrefillCommande['nonProposes'] = [];
  for (const c of cumul) {
    const qte = n(c.qteCumulee);
    if (!c.produit?.id || qte <= 0) continue;
    if (proposes.has(c.produit.id)) quantites[c.produit.id] = String(qte);
    else nonProposes.push({ produitId: c.produit.id, designation: c.produit.designation, qte });
  }
  nonProposes.sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));
  return { quantites, nonProposes };
}

/** Écart signé : `+2`, `−4`, `0`. */
export function formatEcart(ecart: number): string {
  return ecart > 0 ? `+${ecart}` : ecart < 0 ? `−${-ecart}` : '0';
}

/** Ligne du formulaire de livraison (sous-ensemble de `LigneSaisie`). */
export interface LigneFormulaire {
  produitId: UUID;
  designation: string;
  prix: number;
  qte: number;
  memoriserPrix?: boolean;
}

/**
 * « Reprendre les prévisions » : chaque produit prévu prend la quantité
 * Reste (prix et choix déjà saisis conservés) ; les produits prévus absents
 * sont ajoutés au prix habituel ; les autres lignes restent telles quelles.
 * Sur un formulaire vide, donne les lignes préremplies.
 */
export function appliquerPrevisions<L extends LigneFormulaire>(
  lignes: readonly L[],
  prevues: readonly LignePrevue[],
  prixHabituel: number,
): Array<L | LigneFormulaire> {
  const parProduit = new Map(prevues.map((p) => [p.produitId, p] as const));
  const resultat: Array<L | LigneFormulaire> = lignes.map((l) => {
    const p = parProduit.get(l.produitId);
    return p ? { ...l, qte: p.qte } : l;
  });
  for (const p of prevues) {
    if (!lignes.some((l) => l.produitId === p.produitId)) {
      resultat.push({ produitId: p.produitId, designation: p.designation, prix: prixHabituel, qte: p.qte });
    }
  }
  return resultat;
}
