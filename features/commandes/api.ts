import { apiClient } from '../../lib/api-client';
import type {
  CommandeResponse,
  CreerCommandeRequest,
  ProduitFournisseurResponse,
  UUID,
} from '../../types/api';

export const commandesApi = {
  /** Commandes du livreur connecté. */
  mes: async (): Promise<CommandeResponse[]> =>
    (await apiClient.get<CommandeResponse[]>('/commande/me')).data,

  creer: async (payload: CreerCommandeRequest): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>('/commande', payload)).data,

  annuler: async (id: UUID): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/commande/${id}/annuler`)).data,

  /** Commandes LIVREE du livreur connecté chez ce fournisseur, pas encore réglées. */
  aRegler: async (fournisseurId: UUID): Promise<CommandeResponse[]> =>
    (await apiClient.get<CommandeResponse[]>('/commande/a-regler', { params: { fournisseurId } })).data,

  /** Catalogue (produits et prix) d'un fournisseur. */
  catalogue: async (fournisseurId: UUID): Promise<ProduitFournisseurResponse[]> =>
    (await apiClient.get<ProduitFournisseurResponse[]>('/produit-fournisseur', { params: { fournisseurId } })).data,
};
