import { estMembreOrganisation } from '../organisation/regles';
import type { AuthResponse, PrixAchatProduitResponse, UUID } from '../../types/api';

/**
 * P2 / P5 : prix d'achat du livreur indépendant et plancher du prix de vente.
 * Le mobile prévient avant l'envoi avec la même règle et le même message que
 * le back (`PlancherPrixVente`), qui reste juge. Fonctions pures.
 */

/** Table produitId → prix d'achat. Un produit absent n'a aucun prix d'achat connu. */
export type TablePrixAchat = ReadonlyMap<UUID, PrixAchatProduitResponse>;

export function indexPrixAchat(liste: readonly PrixAchatProduitResponse[] | null | undefined): Map<UUID, PrixAchatProduitResponse> {
  return new Map((liste ?? []).map((p) => [p.produitId, p] as const));
}

/**
 * Prix d'achat et plancher : livreur indépendant seulement (principal ou
 * apprenti), jamais pour un membre d'organisation (B2B hors périmètre).
 */
export function avecPrixAchat(user: Pick<AuthResponse, 'organisationId' | 'organisationRole'> | null | undefined): boolean {
  return !!user && !estMembreOrganisation(user);
}

/**
 * Montant au format des messages du back : séparateur de milliers espace
 * ordinaire, pas de décimales pour un montant entier, sinon virgule décimale
 * sans zéro inutile (`1500` → « 1 500 », `1500.5` → « 1 500,5 »).
 */
export function montantPlancher(valeur: number | string | null | undefined): string {
  const n = Number(valeur);
  if (valeur == null || valeur === '' || !Number.isFinite(n)) return '';
  // Arrondi aux centimes (BigDecimal à 2 décimales côté back), zéros inutiles retirés.
  const brut = Math.abs(Math.round(n * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  const [entier, decimales] = brut.split('.');
  const groupe = entier.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const signe = n < 0 && Number(brut) !== 0 ? '-' : '';
  return `${signe}${groupe}${decimales ? `,${decimales}` : ''}`;
}

/** Message exact du refus P5 (identique au back). */
export function messagePlancher(designation: string, prixVente: number, prixAchat: number): string {
  return `Le prix de vente de ${designation} (${montantPlancher(prixVente)} F) est inférieur au prix d'achat (${montantPlancher(prixAchat)} F).`;
}

/**
 * Message P5 si `prixVente` est strictement inférieur au prix d'achat connu du
 * produit ; null sinon (prix égal, prix absent ou nul, aucun prix d'achat connu).
 */
export function erreurPlancher(
  table: TablePrixAchat | null | undefined,
  produitId: UUID,
  designation: string,
  prixVente: number | null | undefined,
): string | null {
  const achat = table?.get(produitId);
  if (!achat || achat.prixAchat == null || prixVente == null || !(Number(prixVente) > 0)) return null;
  const vente = Number(prixVente);
  const prixAchat = Number(achat.prixAchat);
  return vente < prixAchat ? messagePlancher(achat.designation || designation, vente, prixAchat) : null;
}

/**
 * Prix saisi à la main : différent du prix proposé par le système. Sans prix
 * proposé connu, le prix est considéré comme saisi (contrôlé).
 */
export function prixSaisiAMain(prix: number | null | undefined, prixPropose: number | null | undefined): boolean {
  return prixPropose == null || !(Number(prixPropose) > 0) || Number(prix) !== Number(prixPropose);
}

/**
 * Première ligne sous son prix d'achat, dans l'ordre des lignes (comme le back) ; null si aucune. */
export function erreurPlancherLignes(
  table: TablePrixAchat | null | undefined,
  lignes: ReadonlyArray<{ produitId: UUID; designation: string; prix: number; prixPropose?: number | null }>,
): string | null {
  for (const l of lignes) {
    if (!prixSaisiAMain(l.prix, l.prixPropose)) continue;
    const e = erreurPlancher(table, l.produitId, l.designation, l.prix);
    if (e) return e;
  }
  return null;
}
