import type {
  BeneficiaireType,
  EnregistrerReversementRequest,
  ReversementRecord,
  UUID,
} from '../../types/api';
import type { Resultat } from '../commandes/regles';
import { num, parseMontant } from '../encaissements/regles';

/**
 * Règles pures des reversements (remise reversée au client, mois civil).
 * Le back refuse un mois à venir et une date future, et plafonne le
 * montant au reste à reverser : ces gardes locales évitent un aller-retour,
 * les messages du back restent affichés pour le reste.
 */

export interface Periode {
  annee: number;
  /** 1..12 */
  mois: number;
}

export function moisCourant(now: Date = new Date()): Periode {
  return { annee: now.getFullYear(), mois: now.getMonth() + 1 };
}

function rang(p: Periode): number {
  return p.annee * 12 + (p.mois - 1);
}

function depuisRang(r: number): Periode {
  return { annee: Math.floor(r / 12), mois: (r % 12) + 1 };
}

/** Vrai si la période est après le mois courant. */
export function estMoisFutur(p: Periode, now: Date = new Date()): boolean {
  return rang(p) > rang(moisCourant(now));
}

export function moisPrecedent(p: Periode): Periode {
  return depuisRang(rang(p) - 1);
}

/** Mois suivant, borné au mois courant : null si on y est déjà. */
export function moisSuivant(p: Periode, now: Date = new Date()): Periode | null {
  const suivant = depuisRang(rang(p) + 1);
  return estMoisFutur(suivant, now) ? null : suivant;
}

/** Période ramenée au mois courant si elle est dans le futur. */
export function bornerAuMoisCourant(p: Periode, now: Date = new Date()): Periode {
  return estMoisFutur(p, now) ? moisCourant(now) : p;
}

/** Paramètre `mois` de `/livreur/me/reversements-synthese` : `YYYY-MM`. */
export function moisParam(p: Periode): string {
  return `${p.annee}-${String(p.mois).padStart(2, '0')}`;
}

/**
 * Période lue dans les paramètres de navigation ; valeur absente ou
 * invalide → mois courant ; mois à venir → mois courant.
 */
export function periodeDepuisParams(
  mois: string | undefined,
  annee: string | undefined,
  now: Date = new Date(),
): Periode {
  const m = Number(mois);
  const a = Number(annee);
  if (!Number.isInteger(m) || m < 1 || m > 12 || !Number.isInteger(a) || a < 2000) {
    return moisCourant(now);
  }
  return bornerAuMoisCourant({ annee: a, mois: m }, now);
}

/** Suggestion de montant : le reste à reverser serveur s'il est > 0, sinon vide. */
export function montantSuggere(resteAReverser: number | null | undefined): string {
  const r = num(resteAReverser);
  return r > 0 ? String(Math.round(r * 100) / 100) : '';
}

/** Requête de reversement : montant décimal, période et date non futures. */
export function construireReversement(params: {
  type: BeneficiaireType;
  beneficiaireId: UUID | undefined;
  montant: string;
  periode: Periode;
  /** `YYYY-MM-DD` ou null (= aujourd'hui côté serveur). */
  dateReversement: string | null;
  /** `YYYY-MM-DD` local. */
  aujourdhui: string;
  commentaire: string;
  now?: Date;
}): Resultat<EnregistrerReversementRequest> {
  if (!params.beneficiaireId) return { ok: false, erreur: 'Bénéficiaire manquant.' };
  const montant = parseMontant(params.montant);
  if (!montant.ok) return montant;
  if (estMoisFutur(params.periode, params.now ?? new Date())) {
    return { ok: false, erreur: 'La période ne peut pas être un mois à venir.' };
  }
  const date = params.dateReversement?.slice(0, 10) ?? null;
  if (date && date > params.aujourdhui) {
    return { ok: false, erreur: 'La date du reversement ne peut pas être dans le futur.' };
  }
  const commentaire = params.commentaire.trim();
  return {
    ok: true,
    valeur: {
      type: params.type,
      beneficiaireId: params.beneficiaireId,
      montant: montant.valeur,
      mois: params.periode.mois,
      annee: params.periode.annee,
      ...(date ? { dateReversement: `${date}T00:00:00` } : {}),
      ...(commentaire ? { commentaire } : {}),
    },
  };
}

export const MESSAGE_INFORMATIF =
  "Information seulement : seul le fournisseur enregistre le reversement qui compte.";

/**
 * Totaux d'un mois. Un reversement informatif (« reçu » saisi par le livreur
 * pour un fournisseur) n'est compté nulle part : il doublerait celui du fournisseur.
 */
export function totauxReversements(
  rows: Array<Pick<ReversementRecord, 'type' | 'montant' | 'informatif'>>,
): { total: number; clients: number; fournisseurs: number; nombre: number } {
  const comptes = rows.filter((r) => !r.informatif);
  const somme = (l: typeof comptes) => l.reduce((acc, r) => acc + num(r.montant), 0);
  return {
    total: somme(comptes),
    clients: somme(comptes.filter((r) => r.type === 'CLIENT')),
    fournisseurs: somme(comptes.filter((r) => r.type === 'FOURNISSEUR')),
    nombre: comptes.length,
  };
}
