import type { LigneCatalogueFournisseurResponse, ProduitResponse } from '../../types/api';
import { formatFCFA } from '../../lib/format';

/**
 * FM3 : règles du catalogue du fournisseur, miroir du portail web
 * (`FournisseurCataloguePage`, `AjouterProduitDialog`, `ModifierProduitDialog`,
 * `ConfirmerActivationDialog`, `features/catalogue/validation`), au tutoiement.
 */

export type FiltreCatalogue = 'actifs' | 'inactifs' | 'tous';

export const FILTRES_CATALOGUE: ReadonlyArray<{ valeur: FiltreCatalogue; libelle: string }> = [
  { valeur: 'actifs', libelle: 'Actifs' },
  { valeur: 'inactifs', libelle: 'Inactifs' },
  { valeur: 'tous', libelle: 'Tous' },
];

export function filtrerCatalogue(
  lignes: readonly LigneCatalogueFournisseurResponse[] | undefined,
  filtre: FiltreCatalogue,
): LigneCatalogueFournisseurResponse[] {
  return (lignes ?? []).filter((l) => (filtre === 'tous' ? true : filtre === 'actifs' ? l.actif : !l.actif));
}

// ─── Désignation (mêmes règles que le back : `Produit`) ───────────────────

export const MESSAGE_DESIGNATION =
  'La désignation doit contenir de 2 à 100 caractères : lettres, chiffres, espaces, tirets, apostrophes ou points.';

export const MESSAGE_DOUBLON_FOURNISSEUR = 'Ce produit existe déjà : ajoute-le depuis la liste.';

export const MESSAGE_DESIGNATION_NON_MODIFIABLE =
  "Ce produit n'a pas été créé par toi ou est proposé par d'autres fournisseurs : sa désignation n'est pas modifiable.";

const MOTIF_DESIGNATION = /^[\p{L}0-9 .'’-]+$/u;

/** Forme NFC, espaces en tête et en fin supprimés, espaces multiples réduits (comme le back). */
export function nettoyerDesignation(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** Clé de comparaison des doublons : casse ignorée, accents conservés. */
export function normaliserDesignation(s: string): string {
  return nettoyerDesignation(s).toLocaleLowerCase('fr');
}

/** Message d'erreur de la désignation, ou null si elle est valide. */
export function erreurDesignation(saisie: string): string | null {
  const d = nettoyerDesignation(saisie);
  return d.length >= 2 && d.length <= 100 && MOTIF_DESIGNATION.test(d) ? null : MESSAGE_DESIGNATION;
}

// ─── Ajouter un produit ───────────────────────────────────────────────────

/** Nombre maximal de produits du référentiel affichés à la fois (affiner par la recherche). */
export const MAX_RESULTATS = 50;

export type EtatProduit = 'deja' | 'inactif' | 'libre';

/** Lignes du catalogue indexées par produit. */
export function lignesParProduit(
  catalogue: readonly LigneCatalogueFournisseurResponse[] | undefined,
): Map<string, LigneCatalogueFournisseurResponse> {
  return new Map((catalogue ?? []).map((l) => [l.produit.id, l] as const));
}

/** Déjà actif chez lui (non sélectionnable), inactif chez lui (à réactiver), ou libre. */
export function etatProduit(p: Pick<ProduitResponse, 'id'>, lignes: Map<string, LigneCatalogueFournisseurResponse>): EtatProduit {
  const l = lignes.get(p.id);
  return !l ? 'libre' : l.actif ? 'deja' : 'inactif';
}

/**
 * Produits du référentiel correspondant à la recherche (désignation ou code) ;
 * ceux déjà actifs chez lui restent visibles, après les autres. Au plus 50.
 */
export function resultatsReferentiel(
  produits: readonly ProduitResponse[] | undefined,
  lignes: Map<string, LigneCatalogueFournisseurResponse>,
  recherche: string,
): ProduitResponse[] {
  const q = normaliserDesignation(recherche);
  const trouves = q
    ? (produits ?? []).filter(
        (p) => normaliserDesignation(p.designation).includes(q) || p.code.toLocaleLowerCase('fr').includes(q),
      )
    : [...(produits ?? [])];
  const actif = (p: ProduitResponse) => etatProduit(p, lignes) === 'deja';
  return [...trouves.filter((p) => !actif(p)), ...trouves.filter(actif)].slice(0, MAX_RESULTATS);
}

/** Doublon local : un produit du référentiel a la même désignation normalisée. */
export function doublonDe(produits: readonly ProduitResponse[] | undefined, designation: string): ProduitResponse | null {
  const cle = normaliserDesignation(designation);
  if (!cle) return null;
  return (produits ?? []).find((p) => normaliserDesignation(p.designation) === cle) ?? null;
}

// ─── Activation ───────────────────────────────────────────────────────────

export const TEXTE_DESACTIVATION =
  "Ce produit ne pourra plus être commandé chez toi. Les commandes déjà passées se terminent normalement ; le stock et l'historique ne changent pas.";

/** Texte de la confirmation de réactivation (prix de la ligne conservé). */
export const texteReactivation = (prixDeVente: number) =>
  `Ce produit pourra de nouveau être commandé et acheté chez toi, au prix de ${formatFCFA(prixDeVente)} F. Modifie la ligne pour changer ce prix.`;
