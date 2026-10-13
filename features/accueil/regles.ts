import type { MouvementStockResponse, UUID } from '../../types/api';
import { comparerDesignations } from '../../lib/tri';

/**
 * Agrégats de l'écran d'accueil (Tournée) à partir du journal des
 * mouvements de stock du livreur (`GET /stock-livreur/{id}/historique`,
 * quantité signée : + entrée, − sortie).
 */

/** Jour local au format `yyyy-MM-dd` (format des filtres de l'historique). */
export function jourLocal(d: Date = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}

/** Filtres de l'historique pour la journée locale : début et fin = aujourd'hui (jours inclus). */
export function filtresDuJour(now: Date = new Date()): { debut: string; fin: string } {
  const jour = jourLocal(now);
  return { debut: jour, fin: jour };
}

export interface LigneProduitQuantite {
  produitId: UUID;
  designation: string;
  /** Photo du produit (vignette), absente sans photo. */
  photoUrl?: string;
  quantite: number;
}

/** Vrai si le mouvement est du jour `jour` (`yyyy-MM-dd`) ; sans jour, tout passe. */
function duJour(m: MouvementStockResponse, jour?: string): boolean {
  return !jour || (m.date ?? '').slice(0, 10) === jour;
}

function cumulerParProduit(
  mouvements: MouvementStockResponse[],
  quantite: (m: MouvementStockResponse) => number,
): LigneProduitQuantite[] {
  const parProduit = new Map<UUID, LigneProduitQuantite>();
  for (const m of mouvements) {
    const id = m.produit?.id;
    if (!id) continue;
    const ligne = parProduit.get(id) ?? {
      produitId: id,
      designation: m.produit.designation ?? '—',
      photoUrl: m.produit.photoUrl ?? undefined,
      quantite: 0,
    };
    ligne.quantite += quantite(m);
    parProduit.set(id, ligne);
  }
  return [...parProduit.values()]
    .filter((l) => l.quantite > 0)
    .sort((a, b) => comparerDesignations(a.designation, b.designation));
}

/**
 * Produits vendus : Σ des quantités livrées (mouvements LIVRAISON, sortie
 * de stock donc quantité négative) par produit. Les retours ne sont PAS
 * déduits, et une mise à zéro (AJUSTEMENT) n'est pas une vente. Tri
 * alphabétique par désignation (P3).
 */
export function produitsVendus(
  mouvements: MouvementStockResponse[],
  jour?: string,
): LigneProduitQuantite[] {
  return cumulerParProduit(
    mouvements.filter((m) => m.type === 'LIVRAISON' && duJour(m, jour)),
    (m) => -m.quantite,
  );
}

/**
 * Tuile « Produits vendus » : nombre de produits DIFFÉRENTS vendus (lignes
 * de `produitsVendus`, livré seulement) — A×5 + B×3 → 2.
 */
export function nbProduitsVendus(mouvements: MouvementStockResponse[], jour?: string): number {
  return produitsVendus(mouvements, jour).length;
}

/**
 * Tuile « Réceptionnés » : nombre de produits DIFFÉRENTS reçus, d'après les
 * mouvements RECEPTION (entrées fournisseur). Ni les transferts reçus ni les
 * retours ne comptent.
 */
export function nbProduitsRecus(mouvements: MouvementStockResponse[], jour?: string): number {
  return cumulerParProduit(
    mouvements.filter((m) => m.type === 'RECEPTION' && duJour(m, jour) && m.quantite > 0),
    (m) => m.quantite,
  ).length;
}

/** Chiffre d'une sous-carte de l'accueil : `…` en chargement, `—` en erreur. */
export function chiffreAccueil(
  lecture: { isLoading: boolean; isError: boolean },
  valeur: number,
): string {
  if (lecture.isLoading) return '…';
  if (lecture.isError) return '—';
  return String(valeur);
}
