import { apiClient } from '../../lib/api-client';
import type {
  EnregistrerRetourRequest,
  EnregistrerRetourResponse,
  FiltresRetours,
  PageRetoursResponse,
  ProduitLivraisonResponse,
} from '../../types/api';

/** Valeur d'un retour, même formule que le back : (prix + remise unitaire) × quantité. */
export function valeurRetour(
  p: Pick<ProduitLivraisonResponse, 'prixDeVente' | 'remiseUnitaire'>,
  quantite: number,
): number {
  return ((Number(p.prixDeVente) || 0) + (Number(p.remiseUnitaire) || 0)) * (Number(quantite) || 0);
}

/** Quantité encore retournable sur une ligne. */
export function qteRetournable(p: Pick<ProduitLivraisonResponse, 'qteLivre' | 'qteRetourne'>): number {
  return Math.max(0, (p.qteLivre ?? 0) - (p.qteRetourne ?? 0));
}

/** Mois en cours / n derniers jours, en `yyyy-MM-dd` (jours inclus côté back) : voir lib/periode. */
export { derniersJours, moisEnCours } from '../../lib/periode';

/**
 * API retours : lecture du journal (`GET /retour`, page à partir de 0) et
 * saisie d'un retour (`POST /retour`) sans modifier la livraison.
 */
export const retoursApi = {
  lister: async (params: FiltresRetours): Promise<PageRetoursResponse> => {
    const { data } = await apiClient.get<PageRetoursResponse>('/retour', { params });
    return data;
  },
  enregistrer: async (payload: EnregistrerRetourRequest): Promise<EnregistrerRetourResponse> => {
    const { data } = await apiClient.post<EnregistrerRetourResponse>('/retour', payload);
    return data;
  },
};
