import { apiClient } from '../../lib/api-client';
import type { FournisseurResponse } from '../../types/api';

// Mirror minimal de `gestion-livraison-front/src/features/refdata/api.ts` :
// le back n'expose pas de "fournisseurs par livreur" — `GET /fournisseur`
// renvoie la liste plate, et c'est ce que la page web `NouvelleCommandePage`
// utilise. On accumulera ici les autres lookups (quartiers, zones, etc.) au
// fur et à mesure que les écrans en auront besoin.
export const lookupsApi = {
  fournisseurs: async (): Promise<FournisseurResponse[]> => {
    const { data } = await apiClient.get<FournisseurResponse[]>('/fournisseur');
    return data;
  },
};
