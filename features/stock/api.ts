import { apiClient } from '../../lib/api-client';
import type {
  FiltresMouvementsStock,
  MouvementStockResponse,
  StockCourantLigneResponse,
  StockEquipeLigneResponse,
  StockLivreurResponse,
  UUID,
} from '../../types/api';

// Port direct de gestion-livraison-front/src/features/stock/api.ts.
// Les endpoints sont au singulier `/stock-livreur` côté backend (Plan D).
// Lecture seule : le stock n'entre que par une réception de commande, un
// transfert ou un retour remis en stock (plus d'achat manuel).
export const stockApi = {
  /**
   * Stock d'un livreur — une ligne par produit (compteur courant).
   */
  actuel: async (livreurId: UUID): Promise<StockLivreurResponse[]> => {
    const { data } = await apiClient.get<StockLivreurResponse[]>(
      `/stock-livreur/${livreurId}/actuel`,
    );
    return data;
  },

  /**
   * Stock embarqué de toute l'équipe d'un parent (root + apprentis).
   * Renvoie les achats encore présents en stock pour chaque membre de
   * l'équipe, ventilés par (livreur × produit × fournisseur). Utilisé
   * par l'écran « Stock équipe » (root only).
   */
  actuelParent: async (parentId: UUID): Promise<StockLivreurResponse[]> => {
    const { data } = await apiClient.get<StockLivreurResponse[]>(
      `/stock-livreur/parent/${parentId}/actuel`,
    );
    return data;
  },

  /**
   * Stock courant de l'équipe agrégé par tuple (produit × fournisseur), avec
   * ventilation `parLivreur` (root + apprentis). Source de vérité pour
   * l'écran « Stock équipe » repensé : cumul par produit et filtre livreur.
   * Source : `GET /stock-livreur/equipe`.
   */
  equipe: async (): Promise<StockEquipeLigneResponse[]> => {
    const { data } = await apiClient.get<StockEquipeLigneResponse[]>(
      '/stock-livreur/equipe',
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

  /**
   * Journal des mouvements de stock d'un livreur (`GET /stock-livreur/{id}/historique`),
   * du plus récent au plus ancien. Filtres facultatifs : période (jours entiers) et produit.
   */
  historique: async (
    livreurId: UUID,
    filtres: FiltresMouvementsStock = {},
  ): Promise<MouvementStockResponse[]> => {
    const { data } = await apiClient.get<MouvementStockResponse[]>(
      `/stock-livreur/${livreurId}/historique`,
      { params: filtres },
    );
    return data;
  },
};
