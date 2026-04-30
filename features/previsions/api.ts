import { apiClient } from '../../lib/api-client';
import type {
  CreerPrevisionRequest,
  CumulProduitResponse,
  ModifierPrevisionRequest,
  PrevisionResponse,
  UUID,
} from '../../types/api';

export const previsionsApi = {
  byLivreur: async (livreurId: UUID, date: string): Promise<PrevisionResponse[]> =>
    (await apiClient.get<PrevisionResponse[]>(`/prevision/livreur/${livreurId}`, { params: { date } })).data,
  byParent: async (parentId: UUID, date: string): Promise<PrevisionResponse[]> =>
    (await apiClient.get<PrevisionResponse[]>(`/prevision/parent/${parentId}`, { params: { date } })).data,
  cumulByLivreur: async (livreurId: UUID, date: string): Promise<CumulProduitResponse[]> =>
    (await apiClient.get<CumulProduitResponse[]>(`/prevision/cumul/livreur/${livreurId}`, { params: { date } })).data,
  cumulByParent: async (parentId: UUID, date: string): Promise<CumulProduitResponse[]> =>
    (await apiClient.get<CumulProduitResponse[]>(`/prevision/cumul/parent/${parentId}`, { params: { date } })).data,
  create: async (payload: CreerPrevisionRequest): Promise<PrevisionResponse> =>
    (await apiClient.post<PrevisionResponse>('/prevision', payload)).data,
  update: async (id: UUID, payload: ModifierPrevisionRequest): Promise<PrevisionResponse> =>
    (await apiClient.put<PrevisionResponse>(`/prevision/${id}`, payload)).data,
  remove: async (id: UUID): Promise<void> => {
    await apiClient.delete(`/prevision/${id}`);
  },
};
