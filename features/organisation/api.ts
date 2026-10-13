import { apiClient } from '../../lib/api-client';
import type {
  AvoirResponse,
  CreerDemandeChargementRequest,
  DemandeChargementResponse,
  FactureResponse,
  FiltresDocumentsVente,
  OrganisationResponse,
  StatutDemandeChargement,
  UUID,
} from '../../types/api';

/** Paramètres de requête sans les filtres vides. */
function parametres(filtres: object): Record<string, string> | undefined {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtres)) if (typeof v === 'string' && v) p[k] = v;
  return Object.keys(p).length ? p : undefined;
}

/**
 * Organisation B2B, routes du commercial : son organisation (lecture), ses
 * demandes de chargement, ses factures et avoirs (cloisonnés par le back).
 */
export const organisationApi = {
  moi: async (): Promise<OrganisationResponse> =>
    (await apiClient.get<OrganisationResponse>('/organisation/me')).data,

  // --- Demandes de chargement (O8) ---
  mesDemandes: async (statut?: StatutDemandeChargement): Promise<DemandeChargementResponse[]> =>
    (
      await apiClient.get<DemandeChargementResponse[]>(
        '/organisation/me/demandes-chargement/me',
        statut ? { params: { statut } } : undefined,
      )
    ).data,

  creerDemande: async (payload: CreerDemandeChargementRequest): Promise<DemandeChargementResponse> =>
    (await apiClient.post<DemandeChargementResponse>('/organisation/me/demandes-chargement', payload)).data,

  annulerDemande: async (id: UUID): Promise<DemandeChargementResponse> =>
    (
      await apiClient.post<DemandeChargementResponse>(
        `/organisation/me/demandes-chargement/${encodeURIComponent(id)}/annuler`,
      )
    ).data,

  // --- Factures et avoirs (O13, O14, O17) ---
  factures: async (filtres: FiltresDocumentsVente = {}): Promise<FactureResponse[]> => {
    const params = parametres(filtres);
    return (await apiClient.get<FactureResponse[]>('/facture', params ? { params } : undefined)).data;
  },

  facture: async (id: UUID): Promise<FactureResponse> =>
    (await apiClient.get<FactureResponse>(`/facture/${encodeURIComponent(id)}`)).data,

  /** Facture d'une vente (0 ou 1), lue juste après `POST /livraison`. */
  factureDeLivraison: async (livraisonId: UUID): Promise<FactureResponse | null> => {
    const { data } = await apiClient.get<FactureResponse[]>('/facture', { params: { livraisonId } });
    return data[0] ?? null;
  },

  avoirs: async (filtres: FiltresDocumentsVente = {}): Promise<AvoirResponse[]> => {
    const params = parametres(filtres);
    return (await apiClient.get<AvoirResponse[]>('/avoir', params ? { params } : undefined)).data;
  },

  avoir: async (id: UUID): Promise<AvoirResponse> =>
    (await apiClient.get<AvoirResponse>(`/avoir/${encodeURIComponent(id)}`)).data,
};
