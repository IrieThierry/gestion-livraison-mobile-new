import type {
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  UUID,
} from '../../types/api';
import type { Resultat } from '../commandes/regles';
import { formatMontant } from '../../lib/format';

/**
 * Règles pures de l'écran d'encaissement et des totaux cash / accueil.
 * Aucun montant dû n'est calculé ici : soldes, restes dus, répartition et
 * écart viennent du serveur ; seules des sommes d'affichage de valeurs
 * serveur restent locales.
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
 * Libellé de l'écart d'un encaissement (E10), identique au web :
 * négatif → reste dû, positif → surplus vers l'avance, nul → aucun écart.
 */
export function libelleEcart(ecart: number): string {
  const e = num(ecart);
  if (e < 0) return `Reste dû ${formatMontant(-e)}`;
  if (e > 0) return `Surplus ${formatMontant(e)} → avance`;
  return 'Aucun écart';
}

/** Ton d'affichage de l'écart. */
export function tonEcart(ecart: number): 'negatif' | 'nul' | 'positif' {
  const e = num(ecart);
  if (e < 0) return 'negatif';
  if (e > 0) return 'positif';
  return 'nul';
}

/** Un encaissement exige au moins une livraison cochée et un montant > 0. */
export function peutValiderEncaissement(livraisonIds: readonly UUID[], montant: number): boolean {
  return livraisonIds.length > 0 && Number.isFinite(Number(montant)) && Number(montant) > 0;
}

/** Coche ou décoche une livraison (nouveau tableau, ordre conservé). */
export function basculerSelection(ids: UUID[], id: UUID): UUID[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Σ des restes dus (serveur) des livraisons cochées. */
export function totalResteDuSelection(
  livraisons: readonly { id: UUID; resteDu?: number | null }[],
  ids: readonly UUID[],
): number {
  const choisis = new Set(ids);
  return livraisons
    .filter((l) => choisis.has(l.id))
    .reduce((acc, l) => acc + num(l.resteDu), 0);
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

/** Σ des remises nettes (serveur) d'une liste de livraisons. */
export function totalRemiseNette(
  livraisons: readonly { remiseNette?: number | null }[],
): number {
  return livraisons.reduce((acc, l) => acc + num(l.remiseNette), 0);
}

/**
 * Σ des dûs nets serveur (`montantDu` : remise et retours compris, AVANT
 * paiements) d'une liste de livraisons. Jamais `montantLivre` (brut).
 */
export function totalMontantDu(
  livraisons: readonly { montantDu?: number | null }[],
): number {
  return livraisons.reduce((acc, l) => acc + num(l.montantDu), 0);
}

/** Prix unitaire payé par le client sur une ligne : prix de vente + remise unitaire. */
export function prixUnitaireClient(p: {
  prixDeVente?: number | null;
  remiseUnitaire?: number | null;
}): number {
  return num(p.prixDeVente) + num(p.remiseUnitaire);
}

/** Libellé d'un solde serveur : dû, avance ou à jour. */
export function libelleSolde(solde: number): 'du' | 'avance' | 'a-jour' {
  const s = num(solde);
  if (s > 0) return 'du';
  if (s < 0) return 'avance';
  return 'a-jour';
}
