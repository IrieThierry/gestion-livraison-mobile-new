import type {
  CommandeResponse,
  DepenseResponse,
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  FournisseurAvecRelation,
  LivraisonResponse,
  MouvementStockResponse,
  TypeMouvementStock,
  VersementResponse,
} from '../../types/api';
import type { FamilleEtat } from './acces';
import { nomPersonne, type FiltresEtat } from './calculs/commun';
import { ORDRE_TYPES, type LigneStockSource } from './calculs/stock';
import { libelleTypeMouvement } from '../stock/regles';
import { libelleCategorieDepense, ORDRE_CATEGORIES_DEPENSE } from './calculs/depenses';

/**
 * Filtres d'entité des états : options des listes (tirées des données déjà
 * chargées pour l'état) et libellés de l'en-tête. Fonctions pures.
 */

export interface OptionFiltre {
  id: string;
  label: string;
}

/** Listes proposées par l'écran ; une liste absente n'est pas affichée. */
export interface OptionsFiltres {
  clients?: OptionFiltre[];
  produits?: OptionFiltre[];
  fournisseurs?: OptionFiltre[];
  typesMouvement?: OptionFiltre[];
  /** Catégories de dépense (« Toutes » par défaut). */
  categories?: OptionFiltre[];
}

/** Choix de l'écran : identifiant et libellé (pour l'en-tête et le nom du fichier). */
export type ChoixFiltre = OptionFiltre | null;

export interface ChoixFiltres {
  client: ChoixFiltre;
  produit: ChoixFiltre;
  fournisseur: ChoixFiltre;
  typeMouvement: ChoixFiltre;
  categorie: ChoixFiltre;
}

export const AUCUN_FILTRE: ChoixFiltres = {
  client: null,
  produit: null,
  fournisseur: null,
  typeMouvement: null,
  categorie: null,
};

/** Identifiant de l'option « Tous » (valeur par défaut des listes). */
export const ID_TOUS = '__tous__';
export const OPTION_TOUS: OptionFiltre = { id: ID_TOUS, label: 'Tous' };
/** « Toutes » : option par défaut des listes au féminin (catégorie). */
export const OPTION_TOUTES: OptionFiltre = { id: ID_TOUS, label: 'Toutes' };

/**
 * Types de mouvement du filtre : mêmes libellés que les tableaux de l'état,
 * la page Stock et le web (`libelleTypeMouvement`).
 */
export const OPTIONS_TYPES_MOUVEMENT: OptionFiltre[] = ORDRE_TYPES.map((t) => ({
  id: t,
  label: libelleTypeMouvement(t),
}));

/** Options uniques (par identifiant), triées par libellé ; sans identifiant ni libellé : écartées. */
function options(paires: Iterable<[string | null | undefined, string | null | undefined]>): OptionFiltre[] {
  const parId = new Map<string, string>();
  for (const [id, label] of paires) {
    const l = (label ?? '').trim();
    if (!id || !l || parId.has(id)) continue;
    parId.set(id, l);
  }
  return [...parId.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}

/** Ventes : clients et produits des livraisons chargées. */
export function optionsVentes(livraisons: readonly LivraisonResponse[]): OptionsFiltres {
  return {
    clients: options(livraisons.map((l) => [l.client?.id, nomPersonne(l.client)])),
    produits: options(
      livraisons.flatMap((l) =>
        (l.produitsLivraison ?? []).map((p) => [p.produit?.id, p.produit?.designation] as [string, string]),
      ),
    ),
  };
}

/** Encaissements et créances : clients des encaissements et des soldes. */
export function optionsEncaissements(
  encaissements: readonly EncaissementLivraisonResponse[],
  encours: readonly EncoursClientResponse[],
): OptionsFiltres {
  return {
    clients: options([
      ...encaissements.map((e) => [e.client?.id, nomPersonne(e.client)] as [string, string]),
      ...encours.map((c) => [c.clientId, c.nomClient] as [string, string]),
    ]),
  };
}

/** Stock et mouvements : produits du stock et des mouvements, types de mouvement. */
export function optionsStock(
  stock: readonly LigneStockSource[],
  mouvements: readonly MouvementStockResponse[],
): OptionsFiltres {
  return {
    produits: options([
      ...stock.map((l) => [l.produit?.id, l.produit?.designation] as [string, string]),
      ...mouvements.map((m) => [m.produit?.id, m.produit?.designation] as [string, string]),
    ]),
    typesMouvement: OPTIONS_TYPES_MOUVEMENT,
  };
}

/** Fournisseurs et versements : partenaires, fournisseurs des commandes et des versements. */
export function optionsFournisseurs(
  partenaires: readonly FournisseurAvecRelation[],
  commandes: readonly CommandeResponse[],
  versements: readonly VersementResponse[],
): OptionsFiltres {
  return {
    fournisseurs: options([
      ...partenaires
        .filter((p) => p.relation?.statut === 'ACCEPTEE')
        .map((p) => [p.id, p.libelle] as [string, string]),
      ...commandes.map((c) => [c.fournisseur?.id, c.fournisseur?.libelle] as [string, string]),
      ...versements.map((v) => [v.fournisseur?.id, v.fournisseur?.libelle] as [string, string]),
    ]),
  };
}

/**
 * Dépenses : les catégories connues (ordre de la saisie), puis celles
 * rencontrées dans les données.
 */
export function optionsDepenses(depenses: readonly DepenseResponse[]): OptionsFiltres {
  const connues = ORDRE_CATEGORIES_DEPENSE.map((c) => ({ id: c, label: libelleCategorieDepense(c) }));
  const autres = options(
    depenses
      .filter((d) => d.categorie && !ORDRE_CATEGORIES_DEPENSE.includes(d.categorie))
      .map((d) => [d.categorie, libelleCategorieDepense(d.categorie)] as [string, string]),
  );
  return { categories: [...connues, ...autres] };
}

/** Filtres utiles à une famille (les autres sont ignorés). */
export function filtresDeFamille(famille: FamilleEtat, c: ChoixFiltres): ChoixFiltres {
  switch (famille) {
    case 'ventes':
      return { ...AUCUN_FILTRE, client: c.client, produit: c.produit };
    case 'encaissements':
      return { ...AUCUN_FILTRE, client: c.client };
    case 'stock':
      return { ...AUCUN_FILTRE, produit: c.produit, typeMouvement: c.typeMouvement };
    case 'depenses':
      return { ...AUCUN_FILTRE, categorie: c.categorie };
    default:
      return { ...AUCUN_FILTRE, fournisseur: c.fournisseur };
  }
}

/** Identifiants passés aux calculs. */
export function idsFiltres(c: ChoixFiltres): FiltresEtat {
  return {
    clientId: c.client?.id ?? null,
    produitId: c.produit?.id ?? null,
    fournisseurId: c.fournisseur?.id ?? null,
    typeMouvement: (c.typeMouvement?.id as TypeMouvementStock | undefined) ?? null,
    categorie: c.categorie?.id ?? null,
  };
}

/** Ligne d'en-tête d'un filtre actif : `Client : Kouassi Jean`. */
export interface LigneFiltre {
  libelle: string;
  valeur: string;
}

/** Lignes d'en-tête des filtres actifs, dans l'ordre client, produit, fournisseur, type, catégorie. */
export function lignesFiltres(c: ChoixFiltres): LigneFiltre[] {
  const lignes: Array<[string, ChoixFiltre]> = [
    ['Client', c.client],
    ['Produit', c.produit],
    ['Fournisseur', c.fournisseur],
    ['Type de mouvement', c.typeMouvement],
    ['Catégorie', c.categorie],
  ];
  return lignes.filter(([, v]) => !!v).map(([libelle, v]) => ({ libelle, valeur: v!.label }));
}

/** Entités du nom de fichier (client, produit, fournisseur, catégorie ; jamais le type de mouvement). */
export function entitesFichier(c: ChoixFiltres): string[] {
  return [c.client, c.produit, c.fournisseur, c.categorie].filter((v): v is OptionFiltre => !!v).map((v) => v.label);
}
