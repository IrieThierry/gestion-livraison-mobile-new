import { apiClient } from '../../lib/api-client';
import type { AbonnementMe } from '../../types/api';

export const abonnementApi = {
  /**
   * Abonnement effectif de l'utilisateur connecté (`GET /abonnement/me`) :
   * le sien, ou celui de son livreur principal pour un apprenti
   * (`herite: true`). L'admin n'a pas d'abonnement : 204, renvoyé en `null`.
   */
  monAbonnement: async (): Promise<AbonnementMe | null> => {
    const res = await apiClient.get<AbonnementMe | ''>('/abonnement/me');
    if (res.status === 204 || !res.data) return null;
    return res.data;
  },
};
