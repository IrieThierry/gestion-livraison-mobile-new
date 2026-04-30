import { apiClient } from '../../lib/api-client';
import type { ResoudrePrixResponse, UpsertPrixClientRequest, UUID } from '../../types/api';

export const prixApi = {
  /**
   * Résoud le prix unitaire d'un produit pour un client donné.
   * Le back applique la cascade : prix CLIENT → prix LIVREUR → null.
   * Mirror de `prixApi.resoudre` côté web.
   */
  resoudre: async (clientId: UUID, produitId: UUID): Promise<ResoudrePrixResponse> => {
    const { data } = await apiClient.get<ResoudrePrixResponse>('/prix/resoudre', {
      params: { clientId, produitId },
    });
    return data;
  },

  /**
   * Mémorise un prix pour le couple (client, produit) — bouton « Mémoriser »
   * affiché quand le livreur saisit un prix différent du prix résolu.
   */
  upsertPrixClient: async (p: UpsertPrixClientRequest): Promise<void> => {
    await apiClient.put('/prix-client', p);
  },
};
