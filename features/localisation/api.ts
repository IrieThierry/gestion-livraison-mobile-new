import { apiClient } from '../../lib/api-client';
import type { DemandeLocalisationRecue, PersonneLocalisable, UUID } from '../../types/api';

/** Localisation sur demande acceptée (`/localisation`). */
export const localisationApi = {
  /** Personnes que je peux localiser, avec l'état de la dernière demande du jour. */
  personnes: async (): Promise<PersonneLocalisable[]> =>
    (await apiClient.get<PersonneLocalisable[]>('/localisation/personnes')).data,

  demander: async (cibleId: UUID): Promise<{ id: UUID }> =>
    (await apiClient.post<{ id: UUID }>('/localisation/demandes', { cibleId })).data,

  /** Demandes en attente qui me visent. */
  recues: async (): Promise<DemandeLocalisationRecue[]> =>
    (await apiClient.get<DemandeLocalisationRecue[]>('/localisation/demandes/recues')).data,

  accepter: async (demandeId: UUID, position: string): Promise<void> => {
    await apiClient.post(`/localisation/demandes/${encodeURIComponent(demandeId)}/accepter`, { position });
  },

  refuser: async (demandeId: UUID): Promise<void> => {
    await apiClient.post(`/localisation/demandes/${encodeURIComponent(demandeId)}/refuser`);
  },
};
