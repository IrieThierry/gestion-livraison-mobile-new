import { apiClient } from '../../lib/api-client';
import type { ClientResponse, UUID } from '../../types/api';

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
};
