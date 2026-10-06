import type {
  CommandeResponse,
  CreerCommandeRequest,
  ProduitFournisseurResponse,
  StatutCommande,
  UUID,
} from '../../types/api';

/** Quantités saisies, indexées par id de produit (valeurs brutes des champs). */
export type Quantites = Record<UUID, string>;

export type Resultat<T> = { ok: true; valeur: T } | { ok: false; erreur: string };

export type FiltreStatutCommande = StatutCommande | 'TOUTES';

export const FILTRES_STATUT_COMMANDE: Array<{ valeur: FiltreStatutCommande; label: string }> = [
  { valeur: 'TOUTES', label: 'Toutes' },
  { valeur: 'ENVOYEE', label: 'Envoyées' },
  { valeur: 'CONFIRMEE', label: 'Confirmées' },
  { valeur: 'LIVREE', label: 'Livrées' },
  { valeur: 'REFUSEE', label: 'Refusées' },
  { valeur: 'ANNULEE', label: 'Annulées' },
];

// ─── Droits par statut ────────────────────────────────────────────────────

/** Le livreur n'annule que tant que le fournisseur n'a pas répondu. */
export const peutAnnuler = (c: CommandeResponse) => c.statut === 'ENVOYEE';

/** Livrée et pas encore rattachée à un versement. */
export const estReglable = (c: CommandeResponse) => c.statut === 'LIVREE' && c.versementId === null;

/**
 * Lignes du catalogue sur lesquelles on peut commander : actives (`actif !== false`,
 * défense : le back filtre déjà), triées par désignation.
 */
export function lignesCommandables(
  catalogue: ProduitFournisseurResponse[],
): ProduitFournisseurResponse[] {
  return catalogue
    .filter((l) => l.actif !== false)
    .sort((a, b) => a.produit.designation.localeCompare(b.produit.designation, 'fr'));
}

// ─── Validation des saisies ───────────────────────────────────────────────

/** null = champ vide ; NaN = pas un entier ; sinon l'entier saisi. */
function parseEntier(valeur: string | undefined): number | null {
  if (valeur === undefined || valeur.trim() === '') return null;
  const n = Number(valeur);
  return Number.isInteger(n) ? n : Number.NaN;
}

export function construireCommande(
  fournisseurId: string,
  quantites: Quantites,
): Resultat<CreerCommandeRequest> {
  if (!fournisseurId) return { ok: false, erreur: 'Choisis un fournisseur.' };
  const lignes: CreerCommandeRequest['produitsCommandes'] = [];
  for (const [produitId, saisie] of Object.entries(quantites)) {
    const n = parseEntier(saisie);
    if (n === null) continue;
    if (Number.isNaN(n) || n < 1) {
      return { ok: false, erreur: 'Les quantités doivent être des entiers supérieurs ou égaux à 1.' };
    }
    lignes.push({ produitId, qteCommandee: n });
  }
  if (lignes.length === 0) return { ok: false, erreur: 'Saisis au moins une quantité.' };
  return { ok: true, valeur: { fournisseurId, produitsCommandes: lignes } };
}

/**
 * Remise livreur par unité du fournisseur (remise partenaire, identique sur toutes les lignes) :
 * 0 si le catalogue est vide ou si aucune remise n'est accordée.
 */
export function remisePartenaire(catalogue: ProduitFournisseurResponse[]): number {
  return catalogue[0]?.remiseLivreur ?? 0;
}
