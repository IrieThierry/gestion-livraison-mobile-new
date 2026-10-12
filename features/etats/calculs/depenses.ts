import type { DepenseResponse, UUID } from '../../../types/api';
import { arrondi, dansPeriode, num, parDate, retenu, somme, type FiltresEtat, type Periode } from './commun';

/** Libellés des catégories de dépense (mêmes que la saisie et la liste des dépenses). */
export const LIBELLES_CATEGORIE_DEPENSE: Record<string, string> = {
  CARBURANT: 'Carburant',
  ENTRETIEN: 'Entretien',
  ADMINISTRATIF: 'Administratif',
  AUTRE: 'Autre',
};

/** Ordre des catégories connues (les autres suivent, par libellé). */
export const ORDRE_CATEGORIES_DEPENSE = ['CARBURANT', 'ENTRETIEN', 'ADMINISTRATIF', 'AUTRE'];

/** Libellé d'une catégorie ; inconnue : la valeur brute ; vide : « Autre ». */
export function libelleCategorieDepense(categorie: string | null | undefined): string {
  if (!categorie) return LIBELLES_CATEGORIE_DEPENSE.AUTRE;
  return LIBELLES_CATEGORIE_DEPENSE[categorie] ?? categorie;
}

export interface LigneDepense {
  id: UUID;
  date: string;
  categorie: string;
  libelleCategorie: string;
  libelle: string;
  montant: number;
}

export interface LigneCategorie {
  categorie: string;
  libelle: string;
  nb: number;
  montant: number;
}

export interface EtatDepenses {
  depenses: LigneDepense[];
  parCategorie: LigneCategorie[];
  totaux: { nb: number; montant: number };
}

/**
 * État « Dépenses » : dépenses dont `dateDepense` tombe dans la période
 * (jours entiers, bornes incluses), filtre de catégorie facultatif ; liste
 * du plus ancien au plus récent, bloc par catégorie (montant décroissant),
 * total.
 */
export function calculerEtatDepenses(
  depenses: readonly DepenseResponse[],
  periode: Periode,
  filtres: FiltresEtat = {},
): EtatDepenses {
  const lignes: LigneDepense[] = depenses
    .filter((d) => dansPeriode(d.dateDepense, periode))
    .filter((d) => retenu(filtres.categorie, d.categorie || 'AUTRE'))
    .sort(parDate((d) => d.dateDepense))
    .map((d) => ({
      id: d.id,
      date: d.dateDepense,
      categorie: d.categorie || 'AUTRE',
      libelleCategorie: libelleCategorieDepense(d.categorie),
      libelle: d.libelle ?? '',
      montant: arrondi(num(d.montant)),
    }));

  const parCat = new Map<string, LigneCategorie>();
  for (const l of lignes) {
    const c = parCat.get(l.categorie) ?? { categorie: l.categorie, libelle: l.libelleCategorie, nb: 0, montant: 0 };
    c.nb += 1;
    c.montant = arrondi(c.montant + l.montant);
    parCat.set(l.categorie, c);
  }
  const parCategorie = [...parCat.values()].sort(
    (a, b) => b.montant - a.montant || a.libelle.localeCompare(b.libelle, 'fr'),
  );

  return {
    depenses: lignes,
    parCategorie,
    totaux: { nb: lignes.length, montant: somme(lignes, (l) => l.montant) },
  };
}
