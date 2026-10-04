import { apiClient } from '../../lib/api-client';
import type {
  ClientResponse,
  CreerClientRequest,
  EncoursClientResponse,
  ModifierClientRequest,
  UUID,
} from '../../types/api';

// Port de gestion-livraison-front/src/features/clients/api.ts.
// L'endpoint backend est `/client/client-livreur/{livreurId}` (et non
// `/client/par-livreur/...` — le portail web fait foi).
export const clientsApi = {
  byLivreur: async (livreurId: UUID): Promise<ClientResponse[]> => {
    const { data } = await apiClient.get<ClientResponse[]>(
      `/client/client-livreur/${livreurId}`,
    );
    return data;
  },
  enregistrer: async (payload: CreerClientRequest): Promise<ClientResponse> => {
    const { data } = await apiClient.post<ClientResponse>('/client', payload);
    return data;
  },
  /**
   * Modifie un client existant. Endpoint `PUT /client` avec
   * `ModifierClientRequest` (= `CreerClientRequest` + `id`).
   */
  modifier: async (payload: ModifierClientRequest): Promise<void> => {
    await apiClient.put('/client', payload);
  },
  /**
   * Encours (solde, limite, dépassement) de tous les clients d'un livreur,
   * calculés par le serveur. `solde < 0` = avance du client.
   */
  encoursByLivreur: async (livreurId: UUID): Promise<EncoursClientResponse[]> => {
    const { data } = await apiClient.get<EncoursClientResponse[]>(
      `/client/encours/livreur/${livreurId}`,
    );
    return data;
  },
  /** Encours des clients de l'équipe d'un livreur parent (lui et ses apprentis). */
  encoursByParent: async (parentId: UUID): Promise<EncoursClientResponse[]> => {
    const { data } = await apiClient.get<EncoursClientResponse[]>(
      `/client/encours/parent/${parentId}`,
    );
    return data;
  },
  /** Encours d'un client. */
  encours: async (clientId: UUID): Promise<EncoursClientResponse> => {
    const { data } = await apiClient.get<EncoursClientResponse>(`/client/${clientId}/encours`);
    return data;
  },
};
