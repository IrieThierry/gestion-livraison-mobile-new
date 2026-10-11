import type {
  MouvementStockResponse,
  ProduitResponse,
  StockEquipeLigneResponse,
  StockLivreurResponse,
  TypeMouvementStock,
  UUID,
} from '../../../types/api';
import { libelleTypeMouvement } from '../../stock/regles';
import { dansPeriode, num, type Periode } from './commun';

/** Ligne de stock à agréger (une source par livreur ou par équipe). */
export interface LigneStockSource {
  produit: Pick<ProduitResponse, 'id' | 'designation'>;
  qte: number;
}

/** Mouvement à reprendre, avec le livreur concerné pour la vue équipe. */
export type MouvementSource = MouvementStockResponse & { livreur?: string };

export interface LigneStockProduit {
  produitId: UUID;
  designation: string;
  qte: number;
}

export interface LigneMouvement {
  date: string;
  type: TypeMouvementStock;
  libelleType: string;
  produit: string;
  livreur: string;
  /** Signée : + entrée, − sortie. */
  quantite: number;
  /** Référence ; pour un ajustement « Motif : <libellé> » (+ commentaire). */
  detail: string;
}

export interface LigneMouvementParType {
  type: TypeMouvementStock;
  libelle: string;
  nb: number;
  entrees: number;
  sorties: number;
  net: number;
}

export interface EtatStock {
  stock: LigneStockProduit[];
  mouvements: LigneMouvement[];
  parType: LigneMouvementParType[];
  totaux: {
    qteStock: number;
    nbMouvements: number;
    entrees: number;
    sorties: number;
    net: number;
  };
}

/** Ordre d'affichage des types (réception, livraison, retour, transferts, ajustement). */
export const ORDRE_TYPES: TypeMouvementStock[] = [
  'RECEPTION',
  'LIVRAISON',
  'RETOUR_EN_STOCK',
  'TRANSFERT_ENTREE',
  'TRANSFERT_SORTIE',
  'AJUSTEMENT',
];

/** Stock d'un livreur (`/actuel`) en lignes à agréger. */
export function lignesDepuisActuel(lignes: readonly StockLivreurResponse[]): LigneStockSource[] {
  return lignes.map((l) => ({ produit: l.produit, qte: num(l.qte) }));
}

/** Stock de l'équipe (`/equipe`, produit × fournisseur) en lignes à agréger. */
export function lignesDepuisEquipe(lignes: readonly StockEquipeLigneResponse[]): LigneStockSource[] {
  return lignes.map((l) => ({ produit: l.produit, qte: num(l.totalQte) }));
}

/** Détail d'un mouvement : le motif pour un ajustement, sinon la référence. */
export function detailMouvement(m: Pick<MouvementStockResponse, 'type' | 'reference' | 'contrepartie'>): string {
  if (m.type === 'AJUSTEMENT') {
    const motif = m.reference ? `Motif : ${m.reference}` : 'Motif non précisé';
    return m.contrepartie ? `${motif} (${m.contrepartie})` : motif;
  }
  return [m.reference, m.contrepartie].filter(Boolean).join(' · ');
}

/**
 * État « Stock et mouvements » : stock courant par produit (cumulé si
 * plusieurs lignes) et mouvements de la période, détaillés puis cumulés par
 * type. Un ajustement (mise à zéro) est une sortie, jamais une vente.
 */
export function calculerEtatStock(
  stock: readonly LigneStockSource[],
  mouvements: readonly MouvementSource[],
  periode: Periode,
): EtatStock {
  const produits = new Map<UUID, LigneStockProduit>();
  for (const l of stock) {
    const id = l.produit?.id ?? '';
    const p = produits.get(id) ?? {
      produitId: id,
      designation: l.produit?.designation ?? '',
      qte: 0,
    };
    p.qte += num(l.qte);
    produits.set(id, p);
  }
  const lignesStock = [...produits.values()]
    .filter((p) => p.qte !== 0)
    .sort((a, b) => a.designation.localeCompare(b.designation, 'fr'));

  const lignes: LigneMouvement[] = mouvements
    .filter((m) => dansPeriode(m.date, periode))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''))
    .map((m) => ({
      date: m.date,
      type: m.type,
      libelleType: libelleTypeMouvement(m.type),
      produit: m.produit?.designation ?? '',
      livreur: m.livreur ?? '',
      quantite: num(m.quantite),
      detail: detailMouvement(m),
    }));

  const parType: LigneMouvementParType[] = ORDRE_TYPES.map((type) => {
    const duType = lignes.filter((l) => l.type === type);
    const entrees = duType.filter((l) => l.quantite > 0).reduce((a, l) => a + l.quantite, 0);
    const sorties = duType.filter((l) => l.quantite < 0).reduce((a, l) => a - l.quantite, 0);
    return {
      type,
      libelle: libelleTypeMouvement(type),
      nb: duType.length,
      entrees,
      sorties,
      net: entrees - sorties,
    };
  }).filter((t) => t.nb > 0);

  const entrees = parType.reduce((a, t) => a + t.entrees, 0);
  const sorties = parType.reduce((a, t) => a + t.sorties, 0);

  return {
    stock: lignesStock,
    mouvements: lignes,
    parType,
    totaux: {
      qteStock: lignesStock.reduce((a, p) => a + p.qte, 0),
      nbMouvements: lignes.length,
      entrees,
      sorties,
      net: entrees - sorties,
    },
  };
}
