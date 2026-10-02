import { apiClient } from '../../lib/api-client';
import type {
  CreerVersementRequest,
  SituationVersementResponse,
  UUID,
  VersementResponse,
} from '../../types/api';
import { joindreIds } from './regles';

// Pour le mobile on n'expose que `situation` (calcul en lecture) et `enregistrer`
// (création) — les listings restent côté web. Le versement règle des commandes
// livrées (`commandeIds`) ; aucune commande = versement libre.
export const versementsApi = {
  /**
   * Situation du couple (livreur, fournisseur) pour la sélection de commandes :
   * `valeurAchat`, `margeCumulee`, `detteAvant`, `totalDu` (= detteAvant + valeurAchat),
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
