import { apiClient } from '../../lib/api-client';
import type {
  CreerApprentiRequest,
  ResetMotDePasseResponse,
  LivreurResponse,
  UUID,
} from '../../types/api';

/**
 * Mirror exact de `gestion-livraison-front/src/features/apprentis/api.ts`.
 * Les endpoints sont identiques côté back — l'app web et l'app mobile
 * partagent les mêmes apprentis (création/désactivation visibles des deux
 * côtés instantanément).
 */
export const apprentisApi = {
  /**
   * Liste des apprentis d'un parent donné. Renvoie tableau vide si l'user
   * n'a pas d'apprentis. Accessible uniquement aux livreurs root côté
   * back (le `useApprentis` hook applique le gate côté front).
   */
  list: async (parentId: UUID): Promise<LivreurResponse[]> => {
    const { data } = await apiClient.get<LivreurResponse[]>(
      `/livreur/parent/${parentId}`,
    );
    return data;
  },

  /**
   * Crée un nouvel apprenti. Le back vérifie qu'il n'existe pas déjà un
   * livreur avec ce `username`. Renvoie l'ID du livreur créé sous forme
   * de string nu (cf. signature web `Promise<string>`).
   */
  create: async (payload: CreerApprentiRequest): Promise<string> => {
    const { data } = await apiClient.post<string>('/livreur', payload);
    return data;
  },

  /**
   * Active ou désactive un compte apprenti. Quand `actif=false`, le back
   * refuse les login de cet apprenti.
   */
  toggleActif: async (id: UUID, actif: boolean): Promise<void> => {
    await apiClient.put(`/livreur/${id}/actif`, { actif });
  },

  /**
   * Réinitialise le mot de passe d'un apprenti (route existante) : le back
   * génère un mot de passe provisoire, à communiquer à l'apprenti, et traite
   * sa demande « Mot de passe oublié » en attente (M1).
   */
  resetPassword: async (id: UUID): Promise<ResetMotDePasseResponse> => {
    const { data } = await apiClient.post<ResetMotDePasseResponse>(`/livreur/${id}/reset-password`);
    return data;
  },
};
