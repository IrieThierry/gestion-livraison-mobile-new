import { parseMontant } from '../encaissements/regles';
import type { Resultat } from '../commandes/regles';
import type {
  ContesterRemiseArgentRequest,
  DeclarerRemiseArgentRequest,
  RemiseArgentResponse,
  StatutRemiseArgent,
} from '../../types/api';

/**
 * Remises d'argent apprenti → principal : l'apprenti déclare, le principal
 * confirme ou conteste (motif obligatoire), l'apprenti peut annuler tant que
 * la remise est déclarée. Messages identiques à ceux du back.
 */

export const LIBELLE_STATUT_REMISE: Record<StatutRemiseArgent, string> = {
  DECLAREE: 'Déclarée',
  CONFIRMEE: 'Confirmée',
  CONTESTEE: 'Contestée',
  ANNULEE: 'Annulée',
};

export const STATUTS_REMISE: ReadonlyArray<StatutRemiseArgent> = ['DECLAREE', 'CONFIRMEE', 'CONTESTEE', 'ANNULEE'];

export const COMMENTAIRE_REMISE_MAX = 500;
export const MESSAGE_MONTANT_REMISE = 'Le montant doit être supérieur à 0.';
export const MESSAGE_MOTIF_CONTESTATION = 'Précisez le motif de la contestation.';

/** Montant (> 0, 2 décimales) et commentaire facultatif (nettoyé, 500 caractères au plus). */
export function construireDeclaration(montant: string, commentaire: string): Resultat<DeclarerRemiseArgentRequest> {
  const brut = montant.trim().replace(/\s/g, '').replace(',', '.');
  if (brut !== '' && /^\d+(\.\d+)?$/.test(brut) && Number(brut) <= 0) {
    return { ok: false, erreur: MESSAGE_MONTANT_REMISE };
  }
  const m = parseMontant(montant);
  if (!m.ok) return m;
  const c = commentaire.trim();
  if (c.length > COMMENTAIRE_REMISE_MAX) {
    return { ok: false, erreur: `Le commentaire ne doit pas dépasser ${COMMENTAIRE_REMISE_MAX} caractères.` };
  }
  return { ok: true, valeur: c ? { montant: m.valeur, commentaire: c } : { montant: m.valeur } };
}

/** Motif de contestation : obligatoire (nettoyé), 500 caractères au plus. */
export function construireContestation(motif: string): Resultat<ContesterRemiseArgentRequest> {
  const m = motif.trim();
  if (!m) return { ok: false, erreur: MESSAGE_MOTIF_CONTESTATION };
  if (m.length > COMMENTAIRE_REMISE_MAX) {
    return { ok: false, erreur: `Le motif ne doit pas dépasser ${COMMENTAIRE_REMISE_MAX} caractères.` };
  }
  return { ok: true, valeur: { motif: m } };
}

/** L'apprenti annule une remise encore déclarée. */
export const peutAnnuler = (r: Pick<RemiseArgentResponse, 'statut'>) => r.statut === 'DECLAREE';

/** Le principal confirme ou conteste une remise encore déclarée. */
export const peutDecider = (r: Pick<RemiseArgentResponse, 'statut'>) => r.statut === 'DECLAREE';

/** Remises à confirmer (cloche du principal). */
export function nbRemisesAConfirmer(remises: ReadonlyArray<Pick<RemiseArgentResponse, 'statut'>> | undefined): number {
  return (remises ?? []).filter(peutDecider).length;
}

/** Les `n` remises les plus récentes (date, puis référence décroissantes). */
export function dernieresRemises(remises: ReadonlyArray<RemiseArgentResponse>, n = 5): RemiseArgentResponse[] {
  return [...remises]
    .sort((a, b) =>
      a.dateRemise === b.dateRemise
        ? b.reference.localeCompare(a.reference, 'fr', { numeric: true })
        : b.dateRemise.localeCompare(a.dateRemise),
    )
    .slice(0, n);
}

/** Nom affiché d'un apprenti (« Prénom Nom »). */
export function nomLivreur(l: { prenom?: string | null; nom?: string | null } | null | undefined): string {
  return `${l?.prenom ?? ''} ${l?.nom ?? ''}`.trim() || '—';
}
