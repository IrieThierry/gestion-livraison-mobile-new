import { apiClient } from '../../lib/api-client';
import type { EncaissementLivraisonResponse, UUID } from '../../types/api';

// Port direct de gestion-livraison-front/src/features/encaissements/api.ts.
// Pour le mobile (livreur connecté) seul le listing par livreur est utilisé
// pour l'instant — on n'expose pas le listing global ni les encaissements
// commande. Le `POST /encaissement/livraison` est déjà couvert par
// `livraisonsApi.encaisser` (utilisé depuis l'écran encaisser livraison).
export const encaissementsApi = {
  byLivreur: async (livreurId: UUID): Promise<EncaissementLivraisonResponse[]> => {
    const { data } = await apiClient.get<EncaissementLivraisonResponse[]>(
      `/encaissement/livraison/livreur/${livreurId}`,
    );
    return data;
  },
};
