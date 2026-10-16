import { apiClient } from '../../lib/api-client';
import type { Depot, EnregistrerDepotRequest } from '../../types/api';

/** Dépôt : `GET /depot` (200 ou 204), `PUT /depot`, `DELETE /depot`, `GET /depot/visibles`. */
export const depotApi = {
  moi: async (): Promise<Depot | null> => {
    const res = await apiClient.get<Depot | ''>('/depot');
    return res.status === 204 || !res.data ? null : (res.data as Depot);
  },
  enregistrer: async (body: EnregistrerDepotRequest): Promise<Depot> => {
    const { data } = await apiClient.put<Depot>('/depot', body);
    return data;
  },
  retirer: async (): Promise<void> => {
    await apiClient.delete('/depot');
  },
  visibles: async (): Promise<Depot[]> => {
    const { data } = await apiClient.get<Depot[]>('/depot/visibles');
    return data;
  },
};
