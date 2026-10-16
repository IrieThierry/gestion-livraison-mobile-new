import type {
  EnregistrerReversementRequest,
  LivreurPartenaireDuResponse,
  ReversementRecord,
  UUID,
  VersementResponse,
} from '../../types/api';
import { libelleMois } from './regles';
import { nomLivreur } from './gestion';

/**
 * FM3 : règles de l'onglet Argent du fournisseur, mêmes règles que le portail
 * web (`FournisseurVersementsPage`, `FournisseurReversementsPage`).
 */

// ─── Versements reçus ─────────────────────────────────────────────────────

/** Total versé et remise livreur cumulée d'une liste de versements. */
export function totauxVersements(versements: readonly VersementResponse[] | undefined): {
  total: number;
  remise: number;
} {
  return (versements ?? []).reduce(
    (acc, v) => ({
      total: acc.total + (Number(v.montantVerse) || 0),
      remise: acc.remise + (Number(v.remiseLivreurCumulee) || 0),
    }),
    { total: 0, remise: 0 },
  );
}

/** Plus récents d'abord (date du versement). */
export function trierVersements(versements: readonly VersementResponse[] | undefined): VersementResponse[] {
  return [...(versements ?? [])].sort((a, b) => (b.dateVersement ?? '').localeCompare(a.dateVersement ?? ''));
}

/** Nom du livreur d'un versement (prénom et nom présents). */
export const livreurDuVersement = (v: Pick<VersementResponse, 'livreur'>) =>
  v.livreur ? nomLivreur(v.livreur) || 'Livreur' : 'Livreur';

// ─── Reversements ─────────────────────────────────────────────────────────

/**
 * Total reversé : une ligne informative (« reçu » noté par le livreur) n'est
 * comptée nulle part, seule la saisie du fournisseur compte.
 */
export function totalReverse(reversements: readonly ReversementRecord[] | undefined): number {
  return (reversements ?? []).reduce((s, r) => (r.informatif ? s : s + (Number(r.montant) || 0)), 0);
}

/** Plus récents d'abord (date du reversement). */
export function trierReversements(reversements: readonly ReversementRecord[] | undefined): ReversementRecord[] {
  return [...(reversements ?? [])].sort((a, b) => (b.dateReversement ?? '').localeCompare(a.dateReversement ?? ''));
}

/** « octobre 2026 » : période d'un reversement (vide si inconnue). */
export function periodeReversement(r: Pick<ReversementRecord, 'periodeMois' | 'periodeAnnee'>): string {
  if (!r.periodeMois || !r.periodeAnnee) return '';
  return libelleMois(`${r.periodeAnnee}-${String(r.periodeMois).padStart(2, '0')}`);
}

/** Nom d'un livreur partenaire d'après son id (« — » s'il n'est pas dans la liste). */
export function nomPartenaire(partenaires: readonly LivreurPartenaireDuResponse[] | undefined, id: UUID | null): string {
  const p = id ? (partenaires ?? []).find((l) => l.livreur.id === id) : undefined;
  return p ? nomLivreur(p.livreur) : '—';
}

export const MESSAGE_MONTANT_REVERSEMENT = 'Saisis un montant supérieur à 0.';

/**
 * Reversement de la remise à un livreur (type FOURNISSEUR, bénéficiaire = le
 * livreur) pour le mois `yyyy-MM` : montant > 0 obligatoire. Pas de plafond
 * côté back : dépasser le net à reverser n'est qu'un avertissement.
 */
export function construireReversement(saisie: {
  livreurId: UUID;
  mois: string;
  montant: string;
  commentaire: string;
}): { ok: true; valeur: EnregistrerReversementRequest } | { ok: false; erreur: string } {
  const montant = lireMontantSaisi(saisie.montant);
  if (!(montant > 0)) return { ok: false, erreur: MESSAGE_MONTANT_REVERSEMENT };
  const [annee, mois] = saisie.mois.split('-').map(Number);
  const commentaire = saisie.commentaire.trim();
  return {
    ok: true,
    valeur: {
      type: 'FOURNISSEUR',
      beneficiaireId: saisie.livreurId,
      montant,
      mois,
      annee,
      ...(commentaire ? { commentaire } : {}),
    },
  };
}

/** Montant saisi (espaces ignorés, virgule acceptée) ; NaN s'il est illisible. */
export function lireMontantSaisi(saisie: string): number {
  const s = saisie.replace(/\s/g, '').replace(',', '.');
  return s === '' ? NaN : Number(s);
}

/** Avertissement non bloquant : montant supérieur au net à reverser. */
export const depasseNet = (saisie: string, net: number) => lireMontantSaisi(saisie) > net;
