import { apiClient } from '../../lib/api-client';
import type {
  CreerEncaissementLivraisonRequest,
  EncaissementLivraisonResponse,
  SituationEncaissementResponse,
  UUID,
} from '../../types/api';
import { dernierEncaissementDuClient } from './regles';

export interface SituationEncaissementParams {
  livreurId: UUID;
  clientId: UUID;
  /** LocalDateTime ISO (`YYYY-MM-DDTHH:mm:ss`). */
  dateDebut: string;
  dateFin: string;
}

export const encaissementsApi = {
  byLivreur: async (livreurId: UUID): Promise<EncaissementLivraisonResponse[]> => {
    const { data } = await apiClient.get<EncaissementLivraisonResponse[]>(
      `/encaissement/livraison/livreur/${livreurId}`,
    );
    return data;
  },
  /**
   * Situation (lecture seule) d'un client sur une plage :
   * `totalDu` = solde du compte, `valeurLivraisons` / `margeCumulee` =
   * dû et remise des livraisons de la plage, `detteAvant` = reste hors plage.
   */
  situation: async (p: SituationEncaissementParams): Promise<SituationEncaissementResponse> => {
    const { data } = await apiClient.get<SituationEncaissementResponse>(
      '/encaissement/livraison/situation',
      { params: p },
    );
    return data;
  },
  /** `POST /encaissement/livraison` : le back renvoie un simple message texte. */
  creer: async (payload: CreerEncaissementLivraisonRequest): Promise<string> => {
    const { data } = await apiClient.post<string>('/encaissement/livraison', payload);
    return data;
  },
  /**
   * Crée l'encaissement puis relit la liste du livreur pour retrouver
   * l'encaissement créé (`detteApres` calculé par le serveur). La relecture
   * est best-effort : un échec de lecture ne doit PAS faire échouer la
   * mutation (l'écriture a réussi ; un « réessayer » créerait un doublon).
   */
  creerEtRelire: async (
    payload: CreerEncaissementLivraisonRequest,
  ): Promise<EncaissementLivraisonResponse | null> => {
    await encaissementsApi.creer(payload);
    try {
      const liste = await encaissementsApi.byLivreur(payload.livreurId);
      return dernierEncaissementDuClient(liste, payload.clientId) ?? null;
    } catch {
      return null;
    }
  },
};
