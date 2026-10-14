import { apiClient } from '../../lib/api-client';
import type {
  CreerDemandeModifVersementRequest,
  DemandeModificationVersementResponse,
  UUID,
} from '../../types/api';

const BASE = '/livreur/me/demandes-modif-versement';

/** N7 : demandes de modification de versement du livreur (mêmes routes que le web). */
export const demandesModifApi = {
  lister: async (): Promise<DemandeModificationVersementResponse[]> =>
    (await apiClient.get<DemandeModificationVersementResponse[]>(BASE)).data,
  creer: async (payload: CreerDemandeModifVersementRequest): Promise<DemandeModificationVersementResponse> =>
    (await apiClient.post<DemandeModificationVersementResponse>(BASE, payload)).data,
  approuver: async (id: UUID): Promise<DemandeModificationVersementResponse> =>
    (await apiClient.put<DemandeModificationVersementResponse>(`${BASE}/${id}/approuver`)).data,
  rejeter: async (id: UUID, motifDecision: string): Promise<DemandeModificationVersementResponse> =>
    (await apiClient.put<DemandeModificationVersementResponse>(`${BASE}/${id}/rejeter`, { motifDecision })).data,
};
