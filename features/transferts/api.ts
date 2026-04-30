import { apiClient } from '../../lib/api-client';
import type {
  EffectuerTransfertRequest,
  TransfertStockResponse,
  UUID,
} from '../../types/api';

export const transfertsApi = {
  byLivreur: async (livreurId: UUID): Promise<TransfertStockResponse[]> =>
    (await apiClient.get<TransfertStockResponse[]>(`/transfert-stock/livreur/${livreurId}`)).data,
  byParent: async (parentId: UUID): Promise<TransfertStockResponse[]> =>
    (await apiClient.get<TransfertStockResponse[]>(`/transfert-stock/parent/${parentId}`)).data,
  effectuer: async (payload: EffectuerTransfertRequest): Promise<TransfertStockResponse> =>
    (await apiClient.post<TransfertStockResponse>('/transfert-stock', payload)).data,
};
