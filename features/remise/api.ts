import { apiClient } from '../../lib/api-client';
import type {
  RemiseClientProduitResponse,
  UpsertRemiseClientRequest,
  UUID,
} from '../../types/api';

// Remise unitaire convenue par (client, produit) — `/remise-client`.
// Comme les autres features, l'apiClient renvoie le corps tel quel (`data`).
export const remiseApi = {
  parClient: async (clientId: UUID): Promise<RemiseClientProduitResponse[]> =>
    (await apiClient.get<RemiseClientProduitResponse[]>(`/remise-client/${clientId}`)).data,

  enregistrer: async (p: UpsertRemiseClientRequest): Promise<RemiseClientProduitResponse> =>
    (await apiClient.put<RemiseClientProduitResponse>('/remise-client', p)).data,

  supprimer: async (clientId: UUID, produitId: UUID): Promise<void> => {
    await apiClient.delete(`/remise-client/${clientId}/${produitId}`);
  },
};
