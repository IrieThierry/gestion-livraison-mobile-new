import { apiClient } from '../../lib/api-client';
import { trierParProduit } from '../../lib/tri';
import type {
  PrixAchatProduitResponse,
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
    trierParProduit((await apiClient.get<PrixLivreurProduitResponse[]>('/prix-livreur/me')).data),

  /**
   * P2 : prix d'achat le plus bas par produit chez les fournisseurs partenaires
   * (livreur indépendant, principal ou apprenti ; 403 pour une organisation).
   * Un produit absent n'a aucun prix d'achat connu.
   */
  mesPrixAchat: async (): Promise<PrixAchatProduitResponse[]> =>
    (await apiClient.get<PrixAchatProduitResponse[]>('/prix-achat/me')).data,

  upsertPrixLivreur: async (
    p: UpsertPrixLivreurRequest,
  ): Promise<PrixLivreurProduitResponse> =>
    (await apiClient.put<PrixLivreurProduitResponse>('/prix-livreur', p)).data,

  supprimerPrixLivreur: async (produitId: UUID): Promise<void> => {
    await apiClient.delete(`/prix-livreur/${produitId}`);
  },

  // --- Prix custom par client ---
  prixClient: async (clientId: UUID): Promise<PrixClientProduitResponse[]> =>
    trierParProduit((await apiClient.get<PrixClientProduitResponse[]>(`/prix-client/${clientId}`)).data),

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
