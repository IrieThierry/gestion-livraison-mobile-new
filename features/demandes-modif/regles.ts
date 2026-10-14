import type {
  CreerDemandeModifVersementRequest,
  DemandeModificationVersementResponse,
  DemandeModifVersementPayload,
  StatutDemandeModif,
  UUID,
  VersementResponse,
} from '../../types/api';
import type { Resultat } from '../commandes/regles';
import { formatDateLong, formatFCFA } from '../../lib/format';

/**
 * N7 : règles pures des demandes de modification de versement (livreur).
 * Le livreur décide des demandes initiées par un fournisseur ; les siennes
 * attendent la décision du fournisseur.
 */

export const LIBELLE_STATUT_DEMANDE: Record<StatutDemandeModif, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Rejetée',
};

export const MOTIF_REJET_OBLIGATOIRE = 'Le motif du rejet est obligatoire.';
export const MOTIF_DEMANDE_OBLIGATOIRE = 'Le motif de la demande est obligatoire.';
export const AUCUNE_MODIFICATION = 'Indique au moins un champ à modifier.';
export const MONTANT_INVALIDE = 'Le montant versé doit être un nombre positif ou nul.';

/** Demande que le livreur doit décider : en attente et initiée par le fournisseur. */
export const estADecider = (d: Pick<DemandeModificationVersementResponse, 'statut' | 'demandeurType'>) =>
  d.statut === 'PENDING' && d.demandeurType === 'FOURNISSEUR';

const recentEnPremier = (a: DemandeModificationVersementResponse, b: DemandeModificationVersementResponse) =>
  (b.createdAt ?? '').localeCompare(a.createdAt ?? '');

/** En attente (à décider d'abord) et historique (décidées), du plus récent au plus ancien. */
export function separerDemandes(demandes: DemandeModificationVersementResponse[]): {
  enAttente: DemandeModificationVersementResponse[];
  historique: DemandeModificationVersementResponse[];
} {
  const enAttente = demandes
    .filter((d) => d.statut === 'PENDING')
    .sort((a, b) => Number(estADecider(b)) - Number(estADecider(a)) || recentEnPremier(a, b));
  const historique = demandes.filter((d) => d.statut !== 'PENDING').sort(recentEnPremier);
  return { enAttente, historique };
}

/** « Initiée par moi » ou par le fournisseur (libellé renvoyé par le back). */
export function libelleDemandeur(d: Pick<DemandeModificationVersementResponse, 'demandeurType' | 'demandeurLibelle'>): string {
  if (d.demandeurType === 'LIVREUR') return 'Initiée par moi';
  return `Initiée par ${d.demandeurLibelle ?? 'le fournisseur'}`;
}

export interface ChampModifie {
  libelle: string;
  avant: string | null;
  apres: string;
}

const date = (v: string | null | undefined) => (v ? formatDateLong(v) : '—');
const montant = (v: number | null | undefined) => `${formatFCFA(Number(v) || 0)} F`;
const texte = (v: string | null | undefined) => (v && v.trim() ? v : '—');

/**
 * Champs demandés, avec la valeur actuelle du versement (avant) et la valeur
 * demandée (après). `avant` est nul si le versement n'est pas connu.
 */
export function champsModifies(
  p: DemandeModifVersementPayload | null | undefined,
  v: Pick<VersementResponse, 'dateDebut' | 'dateFin' | 'dateVersement' | 'montantVerse' | 'commentaire'> | undefined,
): ChampModifie[] {
  if (!p) return [];
  const champs: ChampModifie[] = [];
  if (p.dateDebut) champs.push({ libelle: 'Début', avant: v ? date(v.dateDebut) : null, apres: date(p.dateDebut) });
  if (p.dateFin) champs.push({ libelle: 'Fin', avant: v ? date(v.dateFin) : null, apres: date(p.dateFin) });
  if (p.dateVersement) {
    champs.push({ libelle: 'Date de versement', avant: v ? date(v.dateVersement) : null, apres: date(p.dateVersement) });
  }
  if (p.montantVerse != null) {
    champs.push({ libelle: 'Montant', avant: v ? montant(v.montantVerse) : null, apres: montant(p.montantVerse) });
  }
  if (p.commentaire != null && p.commentaire !== '') {
    champs.push({ libelle: 'Commentaire', avant: v ? texte(v.commentaire) : null, apres: texte(p.commentaire) });
  }
  return champs;
}

/** Motif de rejet : obligatoire (espaces retirés). */
export function validerMotifRejet(motif: string): Resultat<string> {
  const m = motif.trim();
  return m ? { ok: true, valeur: m } : { ok: false, erreur: MOTIF_REJET_OBLIGATOIRE };
}

/**
 * Demande de modification d'un versement (mêmes champs que le web) : nouvelle
 * date de versement (AAAA-MM-JJ), nouveau montant, nouveau commentaire ; un
 * champ vide n'est pas modifié. Motif obligatoire.
 */
export function construireDemandeModif(saisie: {
  versementId: UUID;
  dateVersement: string | null;
  montantVerse: string;
  commentaire: string;
  motif: string;
}): Resultat<CreerDemandeModifVersementRequest> {
  const payloadModif: DemandeModifVersementPayload = {};
  if (saisie.dateVersement) payloadModif.dateVersement = saisie.dateVersement;
  const brut = saisie.montantVerse.replace(/\s/g, '').replace(',', '.');
  if (brut !== '') {
    const n = Number(brut);
    if (!Number.isFinite(n) || n < 0) return { ok: false, erreur: MONTANT_INVALIDE };
    payloadModif.montantVerse = n;
  }
  if (saisie.commentaire.trim()) payloadModif.commentaire = saisie.commentaire.trim();
  if (Object.keys(payloadModif).length === 0) return { ok: false, erreur: AUCUNE_MODIFICATION };
  const motif = saisie.motif.trim();
  if (!motif) return { ok: false, erreur: MOTIF_DEMANDE_OBLIGATOIRE };
  return { ok: true, valeur: { versementId: saisie.versementId, payloadModif, motifDemande: motif } };
}
