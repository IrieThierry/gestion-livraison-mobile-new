import { apiClient } from '../../lib/api-client';
import type {
  PrixClientProduitResponse,
  PrixLivreurProduitResponse,
  ResoudrePrixResponse,
  UpsertPrixClientRequest,
  UpsertPrixLivreurRequest,
  UUID,
} from '../../types/api';

/**
 * Mirror complet de `gestion-livraison-front/src/features/prix/api.ts`.
 * Les endpoints sont identiques côté back — l'app web et l'app mobile
 * partagent le même état de prix (changement sur l'un visible sur l'autre).
 */
export const prixApi = {
  // --- Prix par défaut du livreur connecté ---
  mesPrix: async (): Promise<PrixLivreurProduitResponse[]> =>
    (await apiClient.get<PrixLivreurProduitResponse[]>('/prix-livreur/me')).data,

  upsertPrixLivreur: async (
    p: UpsertPrixLivreurRequest,
  ): Promise<PrixLivreurProduitResponse> =>
    (await apiClient.put<PrixLivreurProduitResponse>('/prix-livreur', p)).data,

  supprimerPrixLivreur: async (produitId: UUID): Promise<void> => {
    await apiClient.delete(`/prix-livreur/${produitId}`);
  },

  // --- Prix custom par client ---
  prixClient: async (clientId: UUID): Promise<PrixClientProduitResponse[]> =>
    (await apiClient.get<PrixClientProduitResponse[]>(`/prix-client/${clientId}`)).data,

  upsertPrixClient: async (
    p: UpsertPrixClientRequest,
  ): Promise<PrixClientProduitResponse> =>
    (await apiClient.put<PrixClientProduitResponse>('/prix-client', p)).data,

  supprimerPrixClient: async (clientId: UUID, produitId: UUID): Promise<void> => {
    await apiClient.delete(`/prix-client/${clientId}/${produitId}`);
  },

  // --- Résolveur (cascade CLIENT → LIVREUR → null) ---
  resoudre: async (clientId: UUID, produitId: UUID): Promise<ResoudrePrixResponse> =>
    (
      await apiClient.get<ResoudrePrixResponse>('/prix/resoudre', {
        params: { clientId, produitId },
      })
    ).data,
};
