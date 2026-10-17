import { apiClient } from '../../lib/api-client';
import type {
  CatalogueCommisResponse,
  ClientCommisResponse,
  CommandeCommisResponse,
  LigneQuantiteRequest,
  PersonneCommisResponse,
  RecapitulatifRemisesResponse,
  RemiseCommisResponse,
  SortieCommisResponse,
  UUID,
} from '../../types/api';

/**
 * Espace commis (mobile) : routes `/commis/me` du back. Le commis ne voit
 * que des quantités (jamais de prix ni de montant).
 */
export const commisApi = {
  /** Commandes confirmées ou en réception des livreurs partenaires, plus anciennes d'abord. */
  commandes: async (livreurId?: UUID): Promise<CommandeCommisResponse[]> =>
    (
      await apiClient.get<CommandeCommisResponse[]>('/commis/me/commandes', {
        params: livreurId ? { livreurId } : {},
      })
    ).data,

  /** Livreurs titulaires partenaires du fournisseur (ni apprenti, ni livreur bloqué). */
  livreurs: async (): Promise<PersonneCommisResponse[]> =>
    (await apiClient.get<PersonneCommisResponse[]>('/commis/me/livreurs')).data,

  /** Produits actifs du catalogue du fournisseur, sans prix. */
  catalogue: async (): Promise<CatalogueCommisResponse[]> =>
    (await apiClient.get<CatalogueCommisResponse[]>('/commis/me/catalogue')).data,

  /** Remises d'une commande, plus récentes d'abord. */
  remisesCommande: async (commandeId: UUID): Promise<RemiseCommisResponse[]> =>
    (await apiClient.get<RemiseCommisResponse[]>(`/commis/me/commandes/${commandeId}/remises`)).data,

  remettre: async (commandeId: UUID, lignes: LigneQuantiteRequest[]): Promise<RemiseCommisResponse> =>
    (await apiClient.post<RemiseCommisResponse>(`/commis/me/commandes/${commandeId}/remises`, { lignes })).data,

  /** Remise sans commande : le back crée la commande (confirmée) du livreur titulaire. */
  remettreSansCommande: async (livreurId: UUID, lignes: LigneQuantiteRequest[]): Promise<RemiseCommisResponse> =>
    (await apiClient.post<RemiseCommisResponse>('/commis/me/remises', { livreurId, lignes })).data,

  annulerRemise: async (remiseId: UUID): Promise<RemiseCommisResponse> =>
    (await apiClient.post<RemiseCommisResponse>(`/commis/me/remises/${remiseId}/annuler`)).data,

  /** « Commande terminée » : la commande passe à Livrée avec ce qui a été remis et confirmé. */
  terminer: async (commandeId: UUID): Promise<CommandeCommisResponse> =>
    (await apiClient.post<CommandeCommisResponse>(`/commis/me/commandes/${commandeId}/terminer`)).data,

  /** Clients actifs du fournisseur. */
  clients: async (): Promise<ClientCommisResponse[]> =>
    (await apiClient.get<ClientCommisResponse[]>('/commis/me/clients')).data,

  /** Sorties d'un jour (`YYYY-MM-DD`), plus récentes d'abord. */
  sorties: async (date: string): Promise<SortieCommisResponse[]> =>
    (await apiClient.get<SortieCommisResponse[]>('/commis/me/sorties', { params: { date } })).data,

  sortir: async (clientId: UUID, lignes: LigneQuantiteRequest[]): Promise<SortieCommisResponse> =>
    (await apiClient.post<SortieCommisResponse>('/commis/me/sorties', { clientId, lignes })).data,

  /** Annulation le jour même seulement (sinon 400 du back). */
  annulerSortie: async (sortieId: UUID): Promise<SortieCommisResponse> =>
    (await apiClient.post<SortieCommisResponse>(`/commis/me/sorties/${sortieId}/annuler`)).data,

  /** Récapitulatif d'un jour : quantités remises (confirmées) et sorties, remises en attente et refusées à part. */
  recapitulatif: async (date: string): Promise<RecapitulatifRemisesResponse> =>
    (await apiClient.get<RecapitulatifRemisesResponse>('/commis/me/recapitulatif', { params: { date } })).data,
};
