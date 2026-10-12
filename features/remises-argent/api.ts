import { apiClient } from '../../lib/api-client';
import type {
  ContesterRemiseArgentRequest,
  DeclarerRemiseArgentRequest,
  FiltresRemisesArgent,
  RemiseArgentResponse,
  UUID,
} from '../../types/api';

/** Paramètres de requête sans les filtres absents. */
function parametres(filtres: FiltresRemisesArgent = {}): Record<string, string> {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtres)) if (v) p[k] = String(v);
  return p;
}

/** Routes `/remise-argent` du back (dates `yyyy-MM-dd`, bornes incluses). */
export const remisesArgentApi = {
  /** Apprenti : déclare une remise à son principal. */
  declarer: async (payload: DeclarerRemiseArgentRequest): Promise<RemiseArgentResponse> =>
    (await apiClient.post<RemiseArgentResponse>('/remise-argent', payload)).data,
  /** Apprenti : ses remises, la plus récente en premier. */
  miennes: async (filtres?: Omit<FiltresRemisesArgent, 'apprentiId'>): Promise<RemiseArgentResponse[]> =>
    (await apiClient.get<RemiseArgentResponse[]>('/remise-argent/me', { params: parametres(filtres) })).data,
  /** Apprenti : annule une remise encore déclarée. */
  annuler: async (id: UUID): Promise<RemiseArgentResponse> =>
    (await apiClient.post<RemiseArgentResponse>(`/remise-argent/${id}/annuler`)).data,
  /** Principal : remises de ses apprentis. */
  parParent: async (parentId: UUID, filtres?: FiltresRemisesArgent): Promise<RemiseArgentResponse[]> =>
    (
      await apiClient.get<RemiseArgentResponse[]>(`/remise-argent/parent/${parentId}`, {
        params: parametres(filtres),
      })
    ).data,
  /** Principal : confirme une remise déclarée. */
  confirmer: async (id: UUID): Promise<RemiseArgentResponse> =>
    (await apiClient.post<RemiseArgentResponse>(`/remise-argent/${id}/confirmer`)).data,
  /** Principal : conteste une remise déclarée (motif obligatoire). */
  contester: async (id: UUID, payload: ContesterRemiseArgentRequest): Promise<RemiseArgentResponse> =>
    (await apiClient.post<RemiseArgentResponse>(`/remise-argent/${id}/contester`, payload)).data,
};
