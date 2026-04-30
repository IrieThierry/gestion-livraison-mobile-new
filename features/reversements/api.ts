import { apiClient } from '../../lib/api-client';
import type {
  EnregistrerReversementRequest,
  ReversementRecord,
  ReversementsSyntheseLivreurResponse,
} from '../../types/api';

export const reversementsApi = {
  /**
   * Synthèse pour le livreur connecté pour un mois donné (`yyyy-MM`) :
   * deux sections — fournisseurs qui me doivent + clients à qui je dois.
   */
  syntheseLivreur: async (mois: string): Promise<ReversementsSyntheseLivreurResponse> =>
    (await apiClient.get<ReversementsSyntheseLivreurResponse>('/livreur/me/reversements-synthese', { params: { mois } })).data,

  /**
   * Liste des reversements enregistrés sur une période donnée.
   */
  list: async (annee: number, mois: number): Promise<ReversementRecord[]> =>
    (await apiClient.get<ReversementRecord[]>('/reversement', { params: { annee, mois } })).data,

  /**
   * Enregistre un reversement (vers un client ou un fournisseur).
   */
  enregistrer: async (payload: EnregistrerReversementRequest): Promise<ReversementRecord> =>
    (await apiClient.post<ReversementRecord>('/reversement', payload)).data,
};
