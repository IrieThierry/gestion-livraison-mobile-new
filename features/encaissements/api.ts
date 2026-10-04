import { apiClient } from '../../lib/api-client';
import type {
  CreerEncaissementLivraisonRequest,
  EncaissementLivraisonResponse,
  SituationEncaissementResponse,
  UUID,
} from '../../types/api';

export interface SituationEncaissementParams {
  livreurId: UUID;
  clientId: UUID;
  /** LocalDateTime ISO (`YYYY-MM-DDTHH:mm:ss`). */
  dateDebut: string;
  dateFin: string;
}

export const encaissementsApi = {
  byLivreur: async (livreurId: UUID): Promise<EncaissementLivraisonResponse[]> => {
    const { data } = await apiClient.get<EncaissementLivraisonResponse[]>(
      `/encaissement/livraison/livreur/${livreurId}`,
    );
    return data;
  },
  /**
   * Situation (lecture seule) d'un client sur une plage :
   * `totalDu` = solde du compte, `valeurLivraisons` / `margeCumulee` =
   * dû et remise des livraisons de la plage, `detteAvant` = reste hors plage.
   */
  situation: async (p: SituationEncaissementParams): Promise<SituationEncaissementResponse> => {
    const { data } = await apiClient.get<SituationEncaissementResponse>(
      '/encaissement/livraison/situation',
      { params: p },
    );
    return data;
  },
  /**
   * `POST /encaissement/livraison` : le back renvoie l'encaissement créé
   * (référence, `detteAvant`, `detteApres` calculés par le serveur).
   */
  creer: async (
    payload: CreerEncaissementLivraisonRequest,
  ): Promise<EncaissementLivraisonResponse> => {
    const { data } = await apiClient.post<EncaissementLivraisonResponse>(
      '/encaissement/livraison',
      payload,
    );
    return data;
  },
};
