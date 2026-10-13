import { apiClient } from '../../lib/api-client';
import { trierParDesignation } from '../../lib/tri';
import type { ProduitResponse } from '../../types/api';

// Port de gestion-livraison-front/src/features/lookups/api.ts (`produits`).
// Le backend n'expose pas de catalogue par livreur — la page web
// `NouvelleLivraisonPage` charge tous les produits via `GET /produit` et
// prend en charge la tarification au moment d'ajouter une ligne.
export const produitsApi = {
  list: async (): Promise<ProduitResponse[]> => {
    const { data } = await apiClient.get<ProduitResponse[]>('/produit');
    // P3 : référentiel trié par désignation (le back trie aussi).
    return trierParDesignation(data, (p) => p.designation);
  },
};
