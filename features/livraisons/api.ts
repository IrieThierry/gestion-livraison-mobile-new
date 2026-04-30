import { apiClient } from '../../lib/api-client';
import type {
  CreerEncaissementLivraisonRequest,
  CreerLivraisonRequest,
  EncaissementLivraisonResponse,
  LivraisonResponse,
  ModifierLivraisonRequest,
  UUID,
} from '../../types/api';

// Port direct de gestion-livraison-front/src/features/livraisons/api.ts.
// Les endpoints sont au singulier `/livraison` côté backend (le portail web
// utilise les mêmes chemins) — la spec mobile mentionnait `/livraisons` mais
// la source de vérité reste le contrat backend exposé par le web.
//
// `encaisser` n'existe pas dans le module livraisons côté web : le portail
// passe par `encaissementsApi.createLivraison` (`POST /encaissement/livraison`).
// On l'expose ici pour confort (l'app mobile encaisse depuis l'écran détail
// livraison), mais l'endpoint reste celui de l'encaissement.
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
  update: async (payload: ModifierLivraisonRequest): Promise<LivraisonResponse> => {
    const { data } = await apiClient.put<LivraisonResponse>('/livraison', payload);
    return data;
  },
  remove: async (id: UUID): Promise<void> => {
    await apiClient.delete(`/livraison/${id}`);
  },
  encaisser: async (
    payload: CreerEncaissementLivraisonRequest,
  ): Promise<EncaissementLivraisonResponse> => {
    const { data } = await apiClient.post<EncaissementLivraisonResponse>(
      '/encaissement/livraison',
      payload,
    );
    return data;
  },
};
