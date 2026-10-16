import { apiClient } from '../../lib/api-client';
import type {
  CreerDemandeModifVersementRequest,
  DemandeModificationVersementResponse,
  UUID,
} from '../../types/api';

/** Qui consulte les demandes : le livreur principal ou le fournisseur (mêmes règles que le web). */
export type RoleDemandes = 'livreur' | 'fournisseur';

const BASES: Record<RoleDemandes, string> = {
  livreur: '/livreur/me/demandes-modif-versement',
  fournisseur: '/fournisseur/me/demandes-modif-versement',
};

/** N7, FM3 : demandes de modification de versement (mêmes routes que le web, par rôle). */
export function demandesModifApiDe(role: RoleDemandes) {
  const base = BASES[role];
  return {
    lister: async (): Promise<DemandeModificationVersementResponse[]> =>
      (await apiClient.get<DemandeModificationVersementResponse[]>(base)).data,
    creer: async (payload: CreerDemandeModifVersementRequest): Promise<DemandeModificationVersementResponse> =>
      (await apiClient.post<DemandeModificationVersementResponse>(base, payload)).data,
    approuver: async (id: UUID): Promise<DemandeModificationVersementResponse> =>
      (await apiClient.put<DemandeModificationVersementResponse>(`${base}/${id}/approuver`)).data,
    rejeter: async (id: UUID, motifDecision: string): Promise<DemandeModificationVersementResponse> =>
      (await apiClient.put<DemandeModificationVersementResponse>(`${base}/${id}/rejeter`, { motifDecision })).data,
  };
}

/** Demandes du livreur (`/livreur/me/...`). */
export const demandesModifApi = demandesModifApiDe('livreur');
