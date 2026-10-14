import { apiClient } from '../../lib/api-client';
import type {
  CreerDepenseRequest,
  DepenseResponse,
  ModifierDepenseRequest,
  UUID,
} from '../../types/api';

export const depensesApi = {
  /** S5 : `livreurId` (un apprenti) ou `equipe` (principal et apprentis), livreur principal indépendant seulement. */
  list: async (params?: {
    startDate?: string;
    endDate?: string;
    livreurId?: UUID;
    equipe?: boolean;
  }): Promise<DepenseResponse[]> =>
    (await apiClient.get<DepenseResponse[]>('/depense', { params })).data,
  create: async (payload: CreerDepenseRequest): Promise<DepenseResponse> =>
    (await apiClient.post<DepenseResponse>('/depense', payload)).data,
  update: async (id: UUID, payload: ModifierDepenseRequest): Promise<DepenseResponse> =>
    (await apiClient.put<DepenseResponse>(`/depense/${id}`, payload)).data,
  remove: async (id: UUID): Promise<void> => {
    await apiClient.delete(`/depense/${id}`);
  },
};
