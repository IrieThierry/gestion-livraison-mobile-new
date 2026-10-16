import { apiClient } from '../../lib/api-client';
import type {
  CommandeResponse,
  DemandeModificationVersementResponse,
  FournisseurResponse,
  InvitationResponse,
  LivreurPartenaireDuResponse,
  ReversementsSyntheseFournisseurResponse,
  StatutDemandeModif,
  SyntheseFournisseurResponse,
} from '../../types/api';

/**
 * F3 : API self-service du fournisseur connecté, mêmes routes que le portail
 * web (`features/fournisseur-portail/api.ts`). Le back limite chaque route au
 * fournisseur lié au jeton : aucun identifiant de fournisseur n'est envoyé.
 * Les écrans Commandes, Livreurs et Argent (FM2, FM3) complètent cette API.
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
};
