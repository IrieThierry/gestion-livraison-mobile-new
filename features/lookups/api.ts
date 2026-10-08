import { apiClient } from '../../lib/api-client';
import type {
  CategorieResponse,
  FournisseurResponse,
  QuartierResponse,
  ZoneResponse,
} from '../../types/api';

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
  // Fournisseurs en relation acceptée et non bloqués (nouvelle commande).
  // `fournisseurs()` reste sans paramètre : le versement doit pouvoir viser
  // un fournisseur bloqué ou sans relation pour des commandes déjà livrées.
  fournisseursPartenaires: async (): Promise<FournisseurResponse[]> => {
    const { data } = await apiClient.get<FournisseurResponse[]>('/fournisseur', {
      params: { partenaires: true },
    });
    return data;
  },
  quartiers: async (): Promise<QuartierResponse[]> => {
    const { data } = await apiClient.get<QuartierResponse[]>('/quartier');
    return data;
  },
  categories: async (): Promise<CategorieResponse[]> => {
    const { data } = await apiClient.get<CategorieResponse[]>('/categorie');
    return data;
  },
  zones: async (): Promise<ZoneResponse[]> => {
    const { data } = await apiClient.get<ZoneResponse[]>('/zone');
    return data;
  },
};
