import { apiClient } from '../../lib/api-client';
import { trierParProduit } from '../../lib/tri';
import { joindreIds } from '../versements/regles';
import type {
  CommandeResponse,
  DemandeModificationVersementResponse,
  EnregistrerVersementFournisseurRequest,
  FournisseurResponse,
  InvitationResponse,
  LivreurPartenaireDuResponse,
  PrixParticulierLivreurResponse,
  RelationResponse,
  ReversementsSyntheseFournisseurResponse,
  SituationVersementResponse,
  StatutDemandeModif,
  SyntheseFournisseurResponse,
  UUID,
  VersementResponse,
} from '../../types/api';

/**
 * F3 : API self-service du fournisseur connecté, mêmes routes que le portail
 * web (`features/fournisseur-portail/api.ts`). Le back limite chaque route au
 * fournisseur lié au jeton : aucun identifiant de fournisseur n'est envoyé.
 * FM2 : commandes, livreurs partenaires et invitations ; FM3 : Argent.
 */
export const fournisseurMeApi = {
  /** Fiche du fournisseur connecté (nom de l'entreprise : `libelle`). */
  profil: async (): Promise<FournisseurResponse> =>
    (await apiClient.get<FournisseurResponse>('/fournisseur/me')).data,

  /** Synthèse du mois (`yyyy-MM`) : versements reçus, remises, livreurs actifs, top livreurs. */
  synthese: async (mois: string): Promise<SyntheseFournisseurResponse> =>
    (await apiClient.get<SyntheseFournisseurResponse>('/fournisseur/me/synthese', { params: { mois } })).data,

  /** « À reverser aux livreurs » du mois : remise du mois, dette, net à reverser. */
  reversementsSynthese: async (mois: string): Promise<ReversementsSyntheseFournisseurResponse> =>
    (
      await apiClient.get<ReversementsSyntheseFournisseurResponse>('/fournisseur/me/reversements-synthese', {
        params: { mois },
      })
    ).data,

  /** Commandes reçues des livreurs partenaires. */
  commandes: async (): Promise<CommandeResponse[]> =>
    (await apiClient.get<CommandeResponse[]>('/fournisseur/me/commandes')).data,

  /** Livreurs racines en relation acceptée, bloqués compris, avec leur dû et la remise à reverser. */
  livreursPartenaires: async (): Promise<LivreurPartenaireDuResponse[]> =>
    (await apiClient.get<LivreurPartenaireDuResponse[]>('/fournisseur/me/livreurs-partenaires')).data,

  /** Invitations EN_ATTENTE adressées au fournisseur connecté, plus ancienne d'abord. */
  invitations: async (): Promise<InvitationResponse[]> =>
    (await apiClient.get<InvitationResponse[]>('/fournisseur/me/invitations')).data,

  /** Nombre d'invitations en attente (badge). */
  compteInvitations: async (): Promise<number> =>
    (await apiClient.get<{ enAttente: number }>('/fournisseur/me/invitations/compte')).data?.enAttente ?? 0,

  /** Demandes de modification de versement du fournisseur (reçues et envoyées), filtrées par statut. */
  demandesModif: async (statut?: StatutDemandeModif): Promise<DemandeModificationVersementResponse[]> =>
    (
      await apiClient.get<DemandeModificationVersementResponse[]>('/fournisseur/me/demandes-modif-versement', {
        params: statut ? { statut } : undefined,
      })
    ).data,
  // ─── FM2 : commandes reçues ─────────────────────────────────────────────

  confirmerCommande: async (id: UUID): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/fournisseur/me/commandes/${id}/confirmer`)).data,

  /** Motif envoyé tel quel (le mobile l'exige, cf. spec F2) ; corps vide sans motif, comme le web. */
  refuserCommande: async (id: UUID, motif?: string): Promise<CommandeResponse> =>
    (await apiClient.post<CommandeResponse>(`/fournisseur/me/commandes/${id}/refuser`, motif ? { motif } : {})).data,

  // ─── FM2 : livreurs partenaires ─────────────────────────────────────────

  /** Toutes les commandes d'un livreur partenaire chez le fournisseur connecté, plus récente d'abord. */
  commandesLivreur: async (livreurId: UUID): Promise<CommandeResponse[]> =>
    (await apiClient.get<CommandeResponse[]>(`/fournisseur/me/livreurs/${livreurId}/commandes`)).data,

  /** Produits actifs du catalogue, avec le prix particulier de ce livreur (null si aucun), par désignation. */
  prixParticuliersLivreur: async (livreurId: UUID): Promise<PrixParticulierLivreurResponse[]> =>
    trierParProduit(
      (await apiClient.get<PrixParticulierLivreurResponse[]>(`/fournisseur/me/livreurs/${livreurId}/prix-particuliers`))
        .data ?? [],
    ),

  /** Création ou modification du prix particulier (prix seul, obligatoire). */
  enregistrerPrixParticulier: async (pfId: UUID, livreurId: UUID, prixOverride: number): Promise<unknown> =>
    (await apiClient.put(`/fournisseur/me/catalogue/${pfId}/prix-particuliers/${livreurId}`, { prixOverride })).data,

  supprimerPrixParticulier: async (pfId: UUID, livreurId: UUID): Promise<void> => {
    await apiClient.delete(`/fournisseur/me/catalogue/${pfId}/prix-particuliers/${livreurId}`);
  },

  /** Remise livreur par unité (tous produits) : création ou remplacement. */
  enregistrerRemiseLivreur: async (livreurId: UUID, remiseLivreur: number): Promise<unknown> =>
    (await apiClient.put(`/fournisseur/me/livreurs/${livreurId}/remise-livreur`, { remiseLivreur })).data,

  /** Remet la remise à 0 (idempotent). */
  supprimerRemiseLivreur: async (livreurId: UUID): Promise<void> => {
    await apiClient.delete(`/fournisseur/me/livreurs/${livreurId}/remise-livreur`);
  },

  /** Motif facultatif : corps vide sans motif, comme le web. */
  bloquerLivreur: async (livreurId: UUID, motif?: string): Promise<void> => {
    await apiClient.post(`/fournisseur/me/livreurs/${livreurId}/bloquer`, motif ? { motif } : {});
  },

  debloquerLivreur: async (livreurId: UUID): Promise<void> => {
    await apiClient.delete(`/fournisseur/me/livreurs/${livreurId}/bloquer`);
  },

  /** Situation d'un versement pour un livreur et des commandes (aucune = versement libre). */
  versementSituation: async (livreurId: UUID, commandeIds: UUID[]): Promise<SituationVersementResponse> =>
    (
      await apiClient.get<SituationVersementResponse>('/fournisseur/me/versements/situation', {
        params: { livreurId, ...joindreIds(commandeIds) },
      })
    ).data,

  enregistrerVersement: async (payload: EnregistrerVersementFournisseurRequest): Promise<VersementResponse> =>
    (await apiClient.post<VersementResponse>('/fournisseur/me/versements', payload)).data,

  // ─── FM2 : invitations ──────────────────────────────────────────────────

  accepterInvitation: async (id: UUID): Promise<RelationResponse> =>
    (await apiClient.post<RelationResponse>(`/fournisseur/me/invitations/${id}/accepter`)).data,

  refuserInvitation: async (id: UUID): Promise<RelationResponse> =>
    (await apiClient.post<RelationResponse>(`/fournisseur/me/invitations/${id}/refuser`)).data,
};
