import { apiClient } from '../../lib/api-client';
import { trierParProduit } from '../../lib/tri';
import type {
  AvoirResponse,
  CreerDemandeChargementRequest,
  DemandeChargementResponse,
  FactureResponse,
  FiltresDocumentsVente,
  LigneGrillePrix,
  OrganisationResponse,
  StatutDemandeChargement,
  TableauDeBordResponse,
  UUID,
} from '../../types/api';

/** Paramètres de requête sans les filtres vides. */
function parametres(filtres: object): Record<string, string> | undefined {
  const p: Record<string, string> = {};
  for (const [k, v] of Object.entries(filtres)) if (typeof v === 'string' && v) p[k] = v;
  return Object.keys(p).length ? p : undefined;
}

/**
 * Organisation B2B : son organisation (lecture), les demandes de chargement
 * et les factures et avoirs du commercial (cloisonnés par le back), la grille
 * de prix (membres) et le tableau de bord du responsable.
 */
export const organisationApi = {
  moi: async (): Promise<OrganisationResponse> =>
    (await apiClient.get<OrganisationResponse>('/organisation/me')).data,

  /** Grille de prix de l'organisation (O6), en lecture : produit et prix (null s'il n'est pas fixé). */
  grillePrix: async (): Promise<LigneGrillePrix[]> =>
    trierParProduit((await apiClient.get<LigneGrillePrix[]>('/organisation/me/grille-prix')).data),

  /** Tableau de bord du responsable (O16) pour un jour (yyyy-MM-dd). */
  tableauDeBord: async (date: string): Promise<TableauDeBordResponse> =>
    (await apiClient.get<TableauDeBordResponse>('/organisation/me/tableau-de-bord', { params: { date } })).data,

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
