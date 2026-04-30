import { apiClient } from '../../lib/api-client';
import type {
  CreerVersementRequest,
  SituationVersementResponse,
  UUID,
  VersementResponse,
} from '../../types/api';

// Port direct de gestion-livraison-front/src/features/versements/api.ts.
// Pour le mobile MVP on n'expose que `situation` (calcul en lecture)
// et `enregistrer` (création) — les listings et la gestion des
// contestations restent côté web.
export const versementsApi = {
  /**
   * Calcule en lecture la situation du couple (livreur, fournisseur)
   * sur la plage `[dateDebut, dateFin]` : `valeurAchat`, `margeCumulee`,
   * `detteAvant`, `totalDu` (= detteAvant + valeurAchat).
   */
  situation: async (params: {
    livreurId: UUID;
    fournisseurId: UUID;
    dateDebut: string;
    dateFin: string;
  }): Promise<SituationVersementResponse> => {
    const { data } = await apiClient.get<SituationVersementResponse>(
      '/versement/situation',
      { params },
    );
    return data;
  },

  /**
   * Enregistre un versement : crée l'événement de clôture pour la plage
   * `[dateDebut, dateFin]` avec le `montantVerse` saisi, et chaîne la
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
