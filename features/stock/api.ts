import { apiClient } from '../../lib/api-client';
import type {
  StockCourantLigneResponse,
  StockLivreurResponse,
  UUID,
} from '../../types/api';

// Port direct de gestion-livraison-front/src/features/stock/api.ts.
// Les endpoints sont au singulier `/stock-livreur` côté backend (Plan D).
// On expose ici uniquement les méthodes en lecture nécessaires pour la phase
// 4 du mobile : la déclaration et la modification d'achats viendront avec
// la Task 23.
export const stockApi = {
  /**
   * Stock embarqué par fournisseur — une ligne par (produit, fournisseur).
   * C'est la source de vérité pour l'écran "Mon stock" mobile : un livreur
   * peut détenir le même produit acheté chez plusieurs fournisseurs et on
   * veut afficher chaque tuple distinct.
   */
  actuel: async (livreurId: UUID): Promise<StockLivreurResponse[]> => {
    const { data } = await apiClient.get<StockLivreurResponse[]>(
      `/stock-livreur/${livreurId}/actuel`,
    );
    return data;
  },

  /**
   * Stock courant agrégé par produit (somme des achats moins les livraisons
   * enregistrées). Utile pour un total simple "qte vendable maintenant"
   * sans détail fournisseur.
   */
  courant: async (dateDebut?: string, dateFin?: string): Promise<StockCourantLigneResponse[]> => {
    const params = new URLSearchParams();
    if (dateDebut) params.append('dateDebut', dateDebut);
    if (dateFin) params.append('dateFin', dateFin);
    const qs = params.toString();
    const url = `/stock-livreur/me/courant${qs ? `?${qs}` : ''}`;
    const { data } = await apiClient.get<StockCourantLigneResponse[]>(url);
    return data;
  },
};
