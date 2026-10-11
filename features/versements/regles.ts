import type { CommandeResponse, UUID, VersementResponse } from '../../types/api';
import { filtrerRecherche } from '../../lib/recherche';

/**
 * Paramètre de requête `commandeIds` : identifiants séparés par des virgules, absent si la
 * sélection est vide (versement libre). Ne PAS laisser axios sérialiser un tableau
 * (`commandeIds[]=`), non lu par le back Spring.
 */
export function joindreIds(ids: UUID[]): { commandeIds?: string } {
  return ids.length > 0 ? { commandeIds: ids.join(',') } : {};
}

/**
 * Ne garde de la sélection que les commandes encore présentes dans la liste « à régler » :
 * une commande réglée ailleurs (par le fournisseur) ne doit plus être comptée ni envoyée.
 */
export function selectionValide(selection: Set<UUID>, commandes: CommandeResponse[]): Set<UUID> {
  const presents = new Set(commandes.map((c) => c.id));
  return new Set([...selection].filter((id) => presents.has(id)));
}

/** Message d'erreur à afficher, ou null si le versement peut être envoyé. */
export function validerVersement(p: {
  fournisseurId: string;
  montant: string;
  nbCommandes: number;
}): string | null {
  if (!p.fournisseurId) return 'Choisis un fournisseur.';
  if (p.montant.trim() === '') return 'Saisis un montant.';
  const montant = Number(p.montant);
  if (Number.isNaN(montant) || montant < 0) return 'Saisis un montant valide (supérieur ou égal à 0).';
  if (p.nbCommandes === 0 && montant <= 0) {
    return 'Un versement libre (sans commande cochée) doit avoir un montant supérieur à 0.';
  }
  return null;
}

/** Valeur d'une commande dans un versement : prix + remise livreur (F3), comme `valeurAchat`. */
export function valeurCommande(c: Pick<CommandeResponse, 'montantLivre' | 'remiseLivreurLivree'>): number {
  return (c.montantLivre ?? 0) + (c.remiseLivreurLivree ?? 0);
}

// ---------- Liste « Mes versements » ----------

/** Plus récent en premier (date de versement, ISO comparable en texte). */
export function trierVersements(versements: readonly VersementResponse[]): VersementResponse[] {
  return [...versements].sort((a, b) => (b.dateVersement ?? '').localeCompare(a.dateVersement ?? ''));
}

/** Recherche (fournisseur, commentaire, montant) insensible à la casse et aux accents. */
export function rechercherVersements(
  versements: readonly VersementResponse[],
  requete: string,
): VersementResponse[] {
  return filtrerRecherche(versements, requete, (v) => [
    v.fournisseur?.libelle,
    v.commentaire,
    v.montantVerse,
  ]);
}

/** Total versé d'une liste (montants BigDecimal éventuellement en chaîne). */
export function totalVerse(versements: readonly VersementResponse[]): number {
  const total = versements.reduce((acc, v) => acc + (Number(v.montantVerse) || 0), 0);
  return Math.round(total * 100) / 100;
}
