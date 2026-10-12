import type { Resultat } from '../commandes/regles';
import type {
  EffectuerTransfertRequest,
  RefuserTransfertRequest,
  StatutTransfert,
  TransfertStockResponse,
  UUID,
} from '../../types/api';

/**
 * Transferts de stock acceptés : tout transfert part « En attente ». Le
 * décideur (`decideurId`, celui qui ne l'a pas lancé) l'accepte ou le refuse
 * (motif obligatoire) ; l'initiateur (`initieParId`) peut l'annuler tant
 * qu'il est en attente. Aucun calcul de stock ici : le back fait foi.
 */

export const LIBELLE_STATUT_TRANSFERT: Record<StatutTransfert, string> = {
  EN_ATTENTE: 'En attente',
  ACCEPTE: 'Accepté',
  REFUSE: 'Refusé',
  ANNULE: 'Annulé',
};

export const MOTIF_REFUS_MAX = 500;
export const MESSAGE_MOTIF_REFUS = 'Précisez le motif du refus.';
export const LIBELLE_PRINCIPAL_PAR_DEFAUT = 'ton livreur principal';

type Decision = Pick<TransfertStockResponse, 'statut' | 'decideurId' | 'initieParId'>;

/** Le décideur accepte ou refuse un transfert en attente. */
export const peutDeciderTransfert = (t: Decision, moiId: UUID | null | undefined) =>
  !!moiId && t.statut === 'EN_ATTENTE' && t.decideurId === moiId;

/** L'initiateur annule un transfert en attente. */
export const peutAnnulerTransfert = (t: Decision, moiId: UUID | null | undefined) =>
  !!moiId && t.statut === 'EN_ATTENTE' && t.initieParId === moiId;

/** Transferts à recevoir (cloche) : en attente et dont je suis le décideur. */
export function nbTransfertsADecider(
  transferts: ReadonlyArray<Decision> | undefined,
  moiId: UUID | null | undefined,
): number {
  return (transferts ?? []).filter((t) => peutDeciderTransfert(t, moiId)).length;
}

/** Motif de refus : obligatoire (nettoyé), 500 caractères au plus. */
export function construireRefus(motif: string): Resultat<RefuserTransfertRequest> {
  const m = motif.trim();
  if (!m) return { ok: false, erreur: MESSAGE_MOTIF_REFUS };
  if (m.length > MOTIF_REFUS_MAX) {
    return { ok: false, erreur: `Le motif ne doit pas dépasser ${MOTIF_REFUS_MAX} caractères.` };
  }
  return { ok: true, valeur: { motif: m } };
}

/**
 * Sens d'un nouveau transfert :
 *  - `envoyer` (principal) : de moi vers un apprenti ;
 *  - `reprendre` (principal) : de l'apprenti vers moi (reprise, le stock ne
 *    sort de chez l'apprenti qu'à son acceptation) ;
 *  - `rendre` (apprenti) : de moi vers mon principal (destinataire fixe).
 */
export type ModeTransfert = 'envoyer' | 'reprendre' | 'rendre';

export interface SaisieTransfert {
  mode: ModeTransfert;
  moiId: UUID;
  /** Apprenti : son principal (destinataire fixe de « Rendre du stock »). */
  parentId?: UUID | null;
  /** Principal : l'apprenti choisi (destinataire d'un envoi, source d'une reprise). */
  apprentiId?: UUID | null;
  produitId: UUID | null;
  qte: string;
  commentaire: string;
  /** Stock vendable de la source pour ce produit. */
  stockDispo: number;
}

/** Valide la saisie et construit le corps de `POST /transfert-stock`. */
export function construireTransfert(s: SaisieTransfert): Resultat<EffectuerTransfertRequest> {
  let sourceId: UUID;
  let destinataireId: UUID;
  if (s.mode === 'rendre') {
    if (!s.parentId) return { ok: false, erreur: 'Aucun livreur principal.' };
    sourceId = s.moiId;
    destinataireId = s.parentId;
  } else {
    if (!s.apprentiId) return { ok: false, erreur: 'Choisis un apprenti.' };
    sourceId = s.mode === 'reprendre' ? s.apprentiId : s.moiId;
    destinataireId = s.mode === 'reprendre' ? s.moiId : s.apprentiId;
  }
  if (!s.produitId) return { ok: false, erreur: 'Choisis un produit.' };
  const brut = s.qte.trim();
  const qte = /^\d+$/.test(brut) ? parseInt(brut, 10) : 0;
  if (!(qte > 0)) return { ok: false, erreur: 'Quantité invalide.' };
  if (qte > s.stockDispo) return { ok: false, erreur: `Stock insuffisant (max : ${s.stockDispo}).` };
  const commentaire = s.commentaire.trim();
  if (commentaire.length > MOTIF_REFUS_MAX) {
    return { ok: false, erreur: `Le motif ne doit pas dépasser ${MOTIF_REFUS_MAX} caractères.` };
  }
  const valeur: EffectuerTransfertRequest = { sourceId, destinataireId, produitId: s.produitId, qte };
  if (commentaire) valeur.commentaire = commentaire;
  return { ok: true, valeur };
}

/** « Le transfert devra être accepté par <nom>. » */
export const messageAcceptationPar = (nom: string) => `Le transfert devra être accepté par ${nom}.`;

/** « Prénom Nom » d'un livreur. */
export function nomLivreurTransfert(l: { prenom?: string | null; nom?: string | null } | null | undefined): string {
  return `${l?.prenom ?? ''} ${l?.nom ?? ''}`.trim() || '—';
}

/**
 * Nom du principal d'un apprenti, lu dans ses transferts (la session ne porte
 * que `parentId`) ; à défaut, « ton livreur principal ».
 */
export function nomPrincipal(
  transferts: ReadonlyArray<Pick<TransfertStockResponse, 'source' | 'destinataire'>> | undefined,
  parentId: UUID | null | undefined,
): string {
  if (parentId) {
    for (const t of transferts ?? []) {
      for (const l of [t.source, t.destinataire]) {
        if (l?.id === parentId && (l.prenom || l.nom)) return nomLivreurTransfert(l);
      }
    }
  }
  return LIBELLE_PRINCIPAL_PAR_DEFAUT;
}

export type FiltreTransferts = 'TOUS' | 'EN_ATTENTE';

/** Transferts affichés : filtre « En attente », du plus récent au plus ancien. */
export function transfertsAffiches(
  transferts: ReadonlyArray<TransfertStockResponse> | undefined,
  filtre: FiltreTransferts,
): TransfertStockResponse[] {
  return (transferts ?? [])
    .filter((t) => filtre === 'TOUS' || t.statut === 'EN_ATTENTE')
    .sort((a, b) => (b.dateTransfert ?? '').localeCompare(a.dateTransfert ?? ''));
}
