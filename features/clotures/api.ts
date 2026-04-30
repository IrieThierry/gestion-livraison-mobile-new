import { apiClient } from '../../lib/api-client';
import type {
  ClotureJournaliereResponse,
  EnregistrerClotureRequest,
  UUID,
} from '../../types/api';

export const cloturesApi = {
  byLivreur: async (livreurId: UUID): Promise<ClotureJournaliereResponse[]> =>
    (await apiClient.get<ClotureJournaliereResponse[]>(`/cloture-journaliere/livreur/${livreurId}`)).data,
  byParent: async (parentId: UUID): Promise<ClotureJournaliereResponse[]> =>
    (await apiClient.get<ClotureJournaliereResponse[]>(`/cloture-journaliere/parent/${parentId}`)).data,
  enregistrer: async (payload: EnregistrerClotureRequest): Promise<ClotureJournaliereResponse> =>
    (await apiClient.post<ClotureJournaliereResponse>('/cloture-journaliere', payload)).data,
};
