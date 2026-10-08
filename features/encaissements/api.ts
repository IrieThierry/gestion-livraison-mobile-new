import { apiClient } from '../../lib/api-client';
import type {
  ApercuEncaissementRequest,
  ApercuEncaissementResponse,
  CreerEncaissementLivraisonRequest,
  EncaissementLivraisonResponse,
  LivraisonsAEncaisserResponse,
  UUID,
} from '../../types/api';

export const encaissementsApi = {
  byLivreur: async (livreurId: UUID): Promise<EncaissementLivraisonResponse[]> => {
    const { data } = await apiClient.get<EncaissementLivraisonResponse[]>(
      `/encaissement/livraison/livreur/${livreurId}`,
    );
    return data;
  },
  /**
   * Livraisons du client avec un reste dû (tous livreurs), les plus
   * anciennes d'abord, avec le solde et l'avance du client.
   */
  aEncaisser: async (livreurId: UUID, clientId: UUID): Promise<LivraisonsAEncaisserResponse> => {
    const { data } = await apiClient.get<LivraisonsAEncaisserResponse>(
      '/encaissement/livraison/a-encaisser',
      { params: { livreurId, clientId } },
    );
    return data;
  },
  /**
   * Aperçu serveur (aucune écriture) : répartition du montant sur les
   * livraisons cochées, écart et surplus imputé. Mêmes refus 400 que la
   * création.
   */
  apercu: async (payload: ApercuEncaissementRequest): Promise<ApercuEncaissementResponse> => {
    const { data } = await apiClient.post<ApercuEncaissementResponse>(
      '/encaissement/livraison/apercu',
      payload,
    );
    return data;
  },
  /**
   * `POST /encaissement/livraison` : le back renvoie l'encaissement créé
   * (référence, écart mémorisé, `detteAvant`, `detteApres`).
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
