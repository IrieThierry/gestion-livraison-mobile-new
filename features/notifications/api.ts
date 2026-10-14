import { apiClient } from '../../lib/api-client';
import type { CompteNonLuesResponse, NotificationResponse, UUID } from '../../types/api';
import { TAILLE_PAGE_NOTIFICATIONS } from './regles';

/**
 * N8 : notifications de l'utilisateur connecté (destinataire = jeton, jamais
 * un paramètre). Routes permises même avec un abonnement expiré.
 */
export const notificationsApi = {
  /** Page antéchronologique ; `avant` = id de la dernière notification reçue. */
  lister: async (avant?: string, taille = TAILLE_PAGE_NOTIFICATIONS): Promise<NotificationResponse[]> =>
    (
      await apiClient.get<NotificationResponse[]>('/notification/me', {
        params: avant ? { avant, taille } : { taille },
      })
    ).data,
  compterNonLues: async (): Promise<number> =>
    (await apiClient.get<CompteNonLuesResponse>('/notification/me/non-lues/compte')).data?.nonLues ?? 0,
  marquerLue: async (id: UUID): Promise<NotificationResponse> =>
    (await apiClient.put<NotificationResponse>(`/notification/${encodeURIComponent(id)}/lue`)).data,
  toutMarquerLu: async (): Promise<number> =>
    (await apiClient.put<CompteNonLuesResponse>('/notification/me/toutes-lues')).data?.nonLues ?? 0,
};
