import { apiClient } from '../../lib/api-client';
import type {
  CreerLivraisonRequest,
  LivraisonResponse,
  ModifierLivraisonRequest,
  UUID,
} from '../../types/api';

// Port direct de gestion-livraison-front/src/features/livraisons/api.ts.
// Les endpoints sont au singulier `/livraison` côté backend (le portail web
// utilise les mêmes chemins) — la spec mobile mentionnait `/livraisons` mais
// la source de vérité reste le contrat backend exposé par le web.
//
// L'encaissement (`POST /encaissement/livraison`) est dans
// `features/encaissements` (`useCreerEncaissement`).
export const livraisonsApi = {
  list: async (): Promise<LivraisonResponse[]> => {
    const { data } = await apiClient.get<LivraisonResponse[]>('/livraison');
    return data;
  },
  byLivreur: async (livreurId: UUID): Promise<LivraisonResponse[]> => {
    const { data } = await apiClient.get<LivraisonResponse[]>(
      `/livraison/livraison-livreur/${livreurId}`,
    );
    return data;
  },
  create: async (payload: CreerLivraisonRequest): Promise<LivraisonResponse> => {
    const { data } = await apiClient.post<LivraisonResponse>('/livraison', payload);
    return data;
  },
  // Le back renvoie un corps texte (pas de LivraisonResponse) : rien à lire.
  update: async (payload: ModifierLivraisonRequest): Promise<void> => {
    await apiClient.put('/livraison', payload);
  },
  remove: async (id: UUID): Promise<void> => {
    await apiClient.delete(`/livraison/${id}`);
  },
};
