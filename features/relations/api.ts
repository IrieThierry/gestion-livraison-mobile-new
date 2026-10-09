import { apiClient } from '../../lib/api-client';
import type { FournisseurAvecRelation, RelationResponse, UUID } from '../../types/api';

/**
 * Relations livreur ↔ fournisseur : annuaire (`GET /livreur/me/fournisseurs`),
 * invitation et annulation (livreur principal uniquement, le back arbitre).
 */
export const relationsApi = {
  fournisseurs: async (): Promise<FournisseurAvecRelation[]> => {
    const { data } = await apiClient.get<FournisseurAvecRelation[]>('/livreur/me/fournisseurs');
    return data;
  },
  inviter: async (fournisseurId: UUID): Promise<RelationResponse> => {
    const { data } = await apiClient.post<RelationResponse>('/livreur/me/relations-fournisseurs', {
      fournisseurId,
    });
    return data;
  },
  annuler: async (relationId: UUID): Promise<RelationResponse> => {
    const { data } = await apiClient.post<RelationResponse>(
      `/livreur/me/relations-fournisseurs/${relationId}/annuler`,
    );
    return data;
  },
};
