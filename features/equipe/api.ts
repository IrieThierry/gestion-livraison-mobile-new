import { apiClient } from '../../lib/api-client';
import type { Bornes } from '../../lib/periode';
import type {
  ReaffectationEquipeResponse,
  ReaffecterClientsEquipeRequest,
  ReaffecterClientsEquipeResponse,
} from '../../types/api';

/**
 * Réaffectation des clients par la racine d'équipe (P8) : livreur principal
 * indépendant (ni apprenti, ni membre d'organisation). Les routes refusent
 * tout autre appelant (403).
 */
export const equipeApi = {
  /** `POST /equipe/clients/reaffecter` : clients sélectionnés ou zone, vers un apprenti actif ou soi-même. */
  reaffecter: async (payload: ReaffecterClientsEquipeRequest): Promise<ReaffecterClientsEquipeResponse> =>
    (await apiClient.post<ReaffecterClientsEquipeResponse>('/equipe/clients/reaffecter', payload)).data,

  /** `GET /equipe/reaffectations?debut=&fin=` : historique de l'équipe (jours entiers), plus récentes d'abord. */
  reaffectations: async (bornes: Bornes): Promise<ReaffectationEquipeResponse[]> =>
    (
      await apiClient.get<ReaffectationEquipeResponse[]>('/equipe/reaffectations', {
        params: {
          ...(bornes.debut ? { debut: bornes.debut } : {}),
          ...(bornes.fin ? { fin: bornes.fin } : {}),
        },
      })
    ).data,
};
