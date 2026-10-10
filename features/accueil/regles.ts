import type { MouvementStockResponse, UUID } from '../../types/api';

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
  quantite: number;
}

export interface GroupeReception {
  fournisseur: string;
  produits: LigneProduitQuantite[];
  total: number;
}

export const FOURNISSEUR_INCONNU = 'Fournisseur non renseigné';

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
      quantite: 0,
    };
    ligne.quantite += quantite(m);
    parProduit.set(id, ligne);
  }
  return [...parProduit.values()]
    .filter((l) => l.quantite > 0)
    .sort((a, b) => b.quantite - a.quantite || a.designation.localeCompare(b.designation, 'fr'));
}

/**
 * Produits vendus : Σ des quantités livrées (mouvements LIVRAISON, sortie
 * de stock donc quantité négative) par produit. Les retours ne sont PAS
 * déduits. Tri par quantité décroissante.
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
 * Réceptions : mouvements RECEPTION groupés par fournisseur (contrepartie),
 * puis par produit (Σ quantité). Fournisseurs triés par nom, produits par
 * quantité décroissante.
 */
export function receptionsParFournisseur(
  mouvements: MouvementStockResponse[],
  jour?: string,
): GroupeReception[] {
  const parFournisseur = new Map<string, MouvementStockResponse[]>();
  for (const m of mouvements) {
    if (m.type !== 'RECEPTION' || !duJour(m, jour)) continue;
    const fournisseur = m.contrepartie?.trim() || FOURNISSEUR_INCONNU;
    const liste = parFournisseur.get(fournisseur) ?? [];
    liste.push(m);
    parFournisseur.set(fournisseur, liste);
  }
  return [...parFournisseur.entries()]
    .map(([fournisseur, ms]) => {
      const produits = cumulerParProduit(ms, (m) => m.quantite);
      return { fournisseur, produits, total: produits.reduce((a, p) => a + p.quantite, 0) };
    })
    .filter((g) => g.produits.length > 0)
    .sort((a, b) => a.fournisseur.localeCompare(b.fournisseur, 'fr'));
}
