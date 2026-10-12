import type { FamilleEtat } from './acces';
import type { Periode } from './calculs/commun';

/**
 * Nom du fichier d'un état : `Type_Entite_debut_au_fin` (sans extension).
 * Même règle que le web, pour que WhatsApp, l'e-mail ou les Fichiers
 * montrent un nom parlant.
 */

/** Préfixe du nom selon la famille. */
export const TYPE_FICHIER: Record<FamilleEtat, string> = {
  ventes: 'Ventes',
  encaissements: 'Encaissements-Creances',
  stock: 'Stock-Mouvements',
  fournisseurs: 'Fournisseurs-Versements',
  depenses: 'Depenses',
};

/** Entité sans filtre : vue équipe du livreur principal. */
export const ENTITE_EQUIPE = 'Equipe';
/** Entité sans filtre : tous les livreurs (administrateur). */
export const ENTITE_TOUS = 'Tous-les-livreurs';

/**
 * Segment de nom sûr : accents retirés, espaces, apostrophes et tout
 * caractère hors `[A-Za-z0-9-]` remplacés par `-`, `-` consécutifs
 * fusionnés, sans `-` en début ni en fin.
 */
export function assainirSegment(texte: string | null | undefined): string {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ParamsNomFichier {
  famille: FamilleEtat;
  periode: Periode;
  /**
   * Entités filtrées, dans l'ordre client, produit, fournisseur, catégorie (le type de
   * mouvement n'entre pas dans le nom). Vides ou absentes : `livreur`.
   */
  entites?: ReadonlyArray<string | null | undefined>;
  /** Nom du livreur choisi, `Equipe` ou `Tous-les-livreurs`. */
  livreur: string;
}

/** `Ventes_Kouassi-Jean_2026-10-01_au_2026-10-31` (sans extension). */
export function nomFichierEtat(p: ParamsNomFichier): string {
  const entites = (p.entites ?? []).map(assainirSegment).filter(Boolean);
  const entite = entites.length > 0 ? entites.join('_') : assainirSegment(p.livreur) || 'Livreur';
  return [TYPE_FICHIER[p.famille], entite, p.periode.debut, 'au', p.periode.fin].join('_');
}
