import type {
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  UUID,
} from '../../types/api';
import type { Resultat } from '../commandes/regles';

/**
 * Règles pures de l'écran d'encaissement et des totaux cash / accueil.
 * Aucun montant dû n'est calculé ici : soldes et encours viennent du
 * serveur ; seuls l'aperçu de saisie (« dont avance ») et des sommes
 * d'affichage de valeurs serveur restent locaux.
 */

/** Montant saisi : nombre > 0, virgule ou point, 2 décimales maximum. */
export function parseMontant(brut: string): Resultat<number> {
  const s = brut.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return { ok: false, erreur: 'Saisis un montant.' };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) {
    return { ok: false, erreur: 'Montant invalide (nombre positif, 2 décimales maximum).' };
  }
  const valeur = Number(s);
  if (valeur <= 0) return { ok: false, erreur: 'Saisis un montant supérieur à 0.' };
  return { ok: true, valeur };
}

/** `Number()` défensif : un BigDecimal peut arriver en chaîne ("1500.00"). */
export function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Aperçu de saisie : part du paiement au-delà de ce que le client doit
 * (solde serveur). Elle devient une avance (solde négatif), jamais
 * reversée. 0 si le paiement ne dépasse pas le dû.
 */
export function avanceEstimee(soldeServeur: number, montant: number): number {
  const du = Math.max(0, num(soldeServeur));
  return Math.max(0, Math.round((num(montant) - du) * 100) / 100);
}

/**
 * Plage d'un encaissement « sur une période » : le back attend des
 * LocalDateTime ; une date seule vaut début de journée, donc la date de
 * fin est étendue à la fin de la journée pour inclure ses livraisons.
 */
export function plageEnParams(
  dateDebut: string,
  dateFin: string,
): { dateDebut: string; dateFin: string } {
  return { dateDebut: `${dateDebut}T00:00:00`, dateFin: `${dateFin}T23:59:59` };
}

/** Date locale `YYYY-MM-DD` (pas `toISOString`, qui est en UTC). */
export function jourLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Date d'encaissement envoyée : aujourd'hui → rien (le serveur prend
 * l'heure courante) ; un autre jour → ce jour.
 */
export function dateEncaissementParam(
  choisie: string | null,
  aujourdhui: string,
): string | undefined {
  if (!choisie || choisie === aujourdhui) return undefined;
  return `${choisie}T00:00:00`;
}

/** Vrai si la date ISO tombe le même jour local que `now`. */
export function estDuJour(iso: string | null | undefined, now: Date): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d.toDateString() === now.toDateString();
}

/** « Encaissé aujourd'hui » = Σ `montantEncaisse` des encaissements du jour. */
export function encaisseAujourdhui(
  encaissements: readonly EncaissementLivraisonResponse[],
  now: Date = new Date(),
): number {
  return encaissements
    .filter((e) => estDuJour(e.dateEncaissement, now))
    .reduce((acc, e) => acc + num(e.montantEncaisse), 0);
}

/** « À encaisser » = Σ des soldes positifs (serveur) ; les avances ne comptent pas. */
export function totalAEncaisser(encours: readonly EncoursClientResponse[]): number {
  return encours.reduce((acc, e) => acc + Math.max(0, num(e.solde)), 0);
}

/** Σ des avances (soldes négatifs, en valeur absolue). */
export function totalAvances(encours: readonly EncoursClientResponse[]): number {
  return encours.reduce((acc, e) => acc + Math.max(0, -num(e.solde)), 0);
}

/** Index des encours par client. */
export function indexerEncours(
  encours: readonly EncoursClientResponse[] | undefined,
): Map<UUID, EncoursClientResponse> {
  const m = new Map<UUID, EncoursClientResponse>();
  for (const e of encours ?? []) m.set(e.clientId, e);
  return m;
}

/**
 * Suggestion bornée par le solde du client : `montant` (dû net d'une
 * livraison, avant paiements, ou valeur d'une période) ne peut pas être
 * proposé au-delà de ce que le client doit encore (solde serveur > 0).
 */
export function suggestionBornee(montant: number, soldeServeur: number): number {
  return Math.max(0, Math.min(num(montant), Math.max(0, num(soldeServeur))));
}

/** Σ des remises nettes (serveur) d'une liste de livraisons. */
export function totalRemiseNette(
  livraisons: readonly { remiseNette?: number | null }[],
): number {
  return livraisons.reduce((acc, l) => acc + num(l.remiseNette), 0);
}

/** Libellé d'un solde serveur : dû, avance ou à jour. */
export function libelleSolde(solde: number): 'du' | 'avance' | 'a-jour' {
  const s = num(solde);
  if (s > 0) return 'du';
  if (s < 0) return 'avance';
  return 'a-jour';
}
