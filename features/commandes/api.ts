import { apiClient } from '../../lib/api-client';
import type {
  CommandeResponse,
  CreerCommandeRequest,
  LivreurResponse,
  ProduitFournisseurResponse,
  ReceptionCommandeResponse,
  ReceptionnerCommandeRequest,
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

  /** Détail d'une commande (titulaire, apprenti affecté). */
  detail: async (id: UUID): Promise<CommandeResponse> =>
    (await apiClient.get<CommandeResponse>(`/commande/${id}`)).data,

  /** Commandes CONFIRMEE / EN_RECEPTION à réceptionner (apprenti : seulement les siennes). */
  aReceptionner: async (): Promise<CommandeResponse[]> =>
    (await apiClient.get<CommandeResponse[]>('/commande/a-receptionner')).data,

  /** Historique des réceptions, annulées comprises. */
  receptions: async (id: UUID): Promise<ReceptionCommandeResponse[]> =>
    (await apiClient.get<ReceptionCommandeResponse[]>(`/commande/${id}/receptions`)).data,

  receptionner: async (id: UUID, payload: ReceptionnerCommandeRequest): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/commande/${id}/receptions`, payload)).data,

  /** Remplace TOUT le contenu de la réception : envoyer chaque ligne à garder. */
  modifierReception: async (
    id: UUID,
    receptionId: UUID,
    payload: ReceptionnerCommandeRequest,
  ): Promise<CommandeResponse> =>
    (await apiClient.put<CommandeResponse>(`/commande/${id}/receptions/${receptionId}`, payload)).data,

  annulerReception: async (id: UUID, receptionId: UUID): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/commande/${id}/receptions/${receptionId}/annuler`)).data,

  passerLivree: async (id: UUID): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/commande/${id}/passer-livree`)).data,

  /** `null` retire l'apprenti affecté. */
  affecterApprenti: async (id: UUID, apprentiId: UUID | null): Promise<CommandeResponse> =>
    (await apiClient.put<CommandeResponse>(`/commande/${id}/apprenti`, { apprentiId })).data,

  /** Apprentis du livreur principal validés, actifs et non bloqués par ce fournisseur. */
  apprentisAffectables: async (fournisseurId: UUID): Promise<LivreurResponse[]> =>
    (
      await apiClient.get<LivreurResponse[]>('/commande/apprentis-affectables', {
        params: { fournisseurId },
      })
    ).data,
};
