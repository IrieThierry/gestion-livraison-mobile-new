import { apiClient } from '../../lib/api-client';
import type {
  CreerVersementRequest,
  SituationVersementResponse,
  UUID,
  VersementResponse,
} from '../../types/api';
import { joindreIds } from './regles';

// Lecture de la liste du livreur (`parLivreur`), `situation` (calcul en lecture)
// et `enregistrer` (création). Le versement règle des commandes livrées
// (`commandeIds`) ; aucune commande = versement libre.
export const versementsApi = {
  /** Versements du livreur à ses fournisseurs (`GET /versement/livreur/{id}`, sans filtre de période). */
  parLivreur: async (livreurId: UUID): Promise<VersementResponse[]> => {
    const { data } = await apiClient.get<VersementResponse[]>(`/versement/livreur/${livreurId}`);
    return data;
  },

  /**
   * Situation du couple (livreur, fournisseur) pour la sélection de commandes :
   * `valeurAchat`, `remiseLivreurCumulee`, `detteAvant`, `totalDu` (= detteAvant + valeurAchat),
   * `dateDebut`/`dateFin` (nulles si aucune commande), `nbCommandes`.
   */
  situation: async (params: {
    livreurId: UUID;
    fournisseurId: UUID;
    commandeIds: UUID[];
  }): Promise<SituationVersementResponse> => {
    const { data } = await apiClient.get<SituationVersementResponse>('/versement/situation', {
      params: {
        livreurId: params.livreurId,
        fournisseurId: params.fournisseurId,
        ...joindreIds(params.commandeIds),
      },
    });
    return data;
  },

  /**
   * Enregistre un versement : crée l'événement de clôture pour les commandes
   * sélectionnées avec le `montantVerse` saisi, et chaîne la
   * dette via `detteAvant` / `detteApres`.
   */
  enregistrer: async (
    payload: CreerVersementRequest,
  ): Promise<VersementResponse> => {
    const { data } = await apiClient.post<VersementResponse>(
      '/versement',
      payload,
    );
    return data;
  },
};
