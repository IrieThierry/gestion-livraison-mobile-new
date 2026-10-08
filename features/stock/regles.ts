import type { MouvementStockResponse, TypeMouvementStock } from '../../types/api';

const LIBELLES: Record<TypeMouvementStock, string> = {
  RECEPTION: 'Réception',
  TRANSFERT_ENTREE: 'Transfert reçu',
  TRANSFERT_SORTIE: 'Transfert envoyé',
  LIVRAISON: 'Livraison',
  RETOUR_EN_STOCK: 'Retour en stock',
};

/** Libellé d'un type de mouvement de stock (mêmes libellés que le web). */
export function libelleTypeMouvement(type: TypeMouvementStock): string {
  return LIBELLES[type] ?? type;
}

/** Quantité signée affichée : « +25 », « −5 » (vrai signe moins), « 0 ». */
export function libelleQuantiteMouvement(m: Pick<MouvementStockResponse, 'quantite'>): string {
  if (m.quantite > 0) return `+${m.quantite}`;
  if (m.quantite < 0) return `\u2212${Math.abs(m.quantite)}`;
  return '0';
}
