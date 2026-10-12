import { apiClient } from '../../lib/api-client';
import type {
  EffectuerTransfertRequest,
  TransfertStockResponse,
  UUID,
} from '../../types/api';

/**
 * Transferts de stock. Tout transfert part `EN_ATTENTE` : le décideur
 * (`decideurId`) l'accepte ou le refuse, l'initiateur (`initieParId`) peut
 * l'annuler tant qu'il est en attente.
 */
export const transfertsApi = {
  byLivreur: async (livreurId: UUID): Promise<TransfertStockResponse[]> =>
    (await apiClient.get<TransfertStockResponse[]>(`/transfert-stock/livreur/${livreurId}`)).data,
  byParent: async (parentId: UUID): Promise<TransfertStockResponse[]> =>
    (await apiClient.get<TransfertStockResponse[]>(`/transfert-stock/parent/${parentId}`)).data,
  /** Transferts en attente que l'appelant doit accepter ou refuser. */
  aDecider: async (): Promise<TransfertStockResponse[]> =>
    (await apiClient.get<TransfertStockResponse[]>('/transfert-stock/a-decider')).data,
  effectuer: async (payload: EffectuerTransfertRequest): Promise<TransfertStockResponse> =>
    (await apiClient.post<TransfertStockResponse>('/transfert-stock', payload)).data,
  accepter: async (id: UUID): Promise<TransfertStockResponse> =>
    (await apiClient.post<TransfertStockResponse>(`/transfert-stock/${id}/accepter`)).data,
  refuser: async (id: UUID, motif: string): Promise<TransfertStockResponse> =>
    (await apiClient.post<TransfertStockResponse>(`/transfert-stock/${id}/refuser`, { motif })).data,
  annuler: async (id: UUID): Promise<TransfertStockResponse> =>
    (await apiClient.post<TransfertStockResponse>(`/transfert-stock/${id}/annuler`)).data,
};
