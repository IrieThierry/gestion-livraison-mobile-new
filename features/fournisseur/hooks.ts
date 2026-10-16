import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fournisseurMeApi } from './api';
import { fournisseurKeys } from './keys';
import type { EnregistrerVersementFournisseurRequest, UUID } from '../../types/api';

/** Requêtes de l'espace fournisseur : seulement pour un compte FOURNISSEUR connecté. */
function useEstFournisseur(): boolean {
  return useAuthStore((s) => s.user?.profile === 'FOURNISSEUR');
}

/** Relecture des compteurs « À traiter » (comme les badges du portail web). */
const INTERVALLE_COMPTEURS_MS = 60_000;

export function useFournisseurProfil() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.profil(),
    queryFn: fournisseurMeApi.profil,
    staleTime: 5 * 60_000,
    enabled: actif,
  });
}

export function useSyntheseFournisseur(mois: string) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.synthese(mois),
    queryFn: () => fournisseurMeApi.synthese(mois),
    staleTime: 30_000,
    enabled: actif && !!mois,
  });
}

export function useReversementsSyntheseFournisseur(mois: string) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.reversementsSynthese(mois),
    queryFn: () => fournisseurMeApi.reversementsSynthese(mois),
    staleTime: 30_000,
    enabled: actif && !!mois,
  });
}

/** Commandes reçues (Accueil : en attente, livrées ; onglet Commandes). */
export function useCommandesFournisseur() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.commandes(),
    queryFn: fournisseurMeApi.commandes,
    staleTime: 30_000,
    refetchInterval: INTERVALLE_COMPTEURS_MS,
    enabled: actif,
  });
}

export function useLivreursPartenaires() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.partenaires(),
    queryFn: fournisseurMeApi.livreursPartenaires,
    staleTime: 15_000,
    enabled: actif,
  });
}

/** Nombre d'invitations en attente (« À traiter », badge de l'onglet Livreurs). */
export function useCompteInvitations() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.compteInvitations(),
    queryFn: fournisseurMeApi.compteInvitations,
    staleTime: 30_000,
    refetchInterval: INTERVALLE_COMPTEURS_MS,
    enabled: actif,
  });
}

/** Demandes de modification de versement en attente (reçues et envoyées). */
export function useDemandesModifFournisseurEnAttente() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.demandesModif('PENDING'),
    queryFn: () => fournisseurMeApi.demandesModif('PENDING'),
    staleTime: 30_000,
    refetchInterval: INTERVALLE_COMPTEURS_MS,
    enabled: actif,
  });
}

// ─── FM2 : lectures des écrans Commandes et Livreurs ─────────────────────

/** Invitations EN_ATTENTE (écran Invitations de l'onglet Livreurs). */
export function useInvitationsFournisseur() {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.invitations(),
    queryFn: fournisseurMeApi.invitations,
    staleTime: 15_000,
    enabled: actif,
  });
}

/** Commandes d'un livreur partenaire (fiche du livreur). */
export function useCommandesLivreurFournisseur(livreurId: UUID | undefined) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.commandesLivreur(livreurId ?? ''),
    queryFn: () => fournisseurMeApi.commandesLivreur(livreurId!),
    staleTime: 0,
    enabled: actif && !!livreurId,
  });
}

/** Produits actifs avec le prix particulier d'un livreur. */
export function usePrixParticuliersLivreur(livreurId: UUID | undefined) {
  const actif = useEstFournisseur();
  return useQuery({
    queryKey: fournisseurKeys.prixParticuliersLivreur(livreurId ?? ''),
    queryFn: () => fournisseurMeApi.prixParticuliersLivreur(livreurId!),
    staleTime: 0,
    enabled: actif && !!livreurId,
  });
}

/** Situation du versement qu'enregistre le fournisseur (aucune commande cochée = versement libre). */
export function useSituationVersementFournisseur(livreurId: UUID | undefined, commandeIds: UUID[]) {
  const actif = useEstFournisseur();
  const cle = [...commandeIds].sort().join(',');
  return useQuery({
    queryKey: fournisseurKeys.situationVersement(livreurId ?? '', cle),
    queryFn: () => fournisseurMeApi.versementSituation(livreurId!, commandeIds),
    enabled: actif && !!livreurId,
  });
}

// ─── FM2 : écritures (messages affichés par les écrans) ──────────────────

/** Confirmer ou refuser : la liste des commandes et celles du livreur (sous les partenaires) sont relues. */
function invaliderCommandes(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: fournisseurKeys.commandes() });
  qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() });
}

export function useConfirmerCommandeFournisseur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => fournisseurMeApi.confirmerCommande(id),
    // Succès ou refus du back (commande déjà traitée ailleurs) : l'état réel est relu.
    onSettled: () => invaliderCommandes(qc),
  });
}

export function useRefuserCommandeFournisseur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: UUID; motif?: string }) => fournisseurMeApi.refuserCommande(id, motif),
    onSettled: () => invaliderCommandes(qc),
  });
}

export function useEnregistrerRemiseLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ livreurId, remiseLivreur }: { livreurId: UUID; remiseLivreur: number }) =>
      fournisseurMeApi.enregistrerRemiseLivreur(livreurId, remiseLivreur),
    onSuccess: () => qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() }),
  });
}

export function useSupprimerRemiseLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (livreurId: UUID) => fournisseurMeApi.supprimerRemiseLivreur(livreurId),
    onSuccess: () => qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() }),
  });
}

/**
 * Après une écriture de prix particulier : la liste du livreur (sous les partenaires) et le
 * catalogue. Attendue par la mutation : le verrou de la ligne n'est libéré qu'une fois la liste relue.
 */
function invaliderPrixParticuliers(qc: QueryClient) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() }),
    qc.invalidateQueries({ queryKey: [...fournisseurKeys.all, 'catalogue'] }),
  ]);
}

export function useEnregistrerPrixParticulier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pfId, livreurId, prix }: { pfId: UUID; livreurId: UUID; prix: number }) =>
      fournisseurMeApi.enregistrerPrixParticulier(pfId, livreurId, prix),
    onSuccess: () => invaliderPrixParticuliers(qc),
  });
}

export function useSupprimerPrixParticulier() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ pfId, livreurId }: { pfId: UUID; livreurId: UUID }) =>
      fournisseurMeApi.supprimerPrixParticulier(pfId, livreurId),
    onSuccess: () => invaliderPrixParticuliers(qc),
  });
}

export function useBloquerLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ livreurId, motif }: { livreurId: UUID; motif?: string }) =>
      fournisseurMeApi.bloquerLivreur(livreurId, motif),
    onSuccess: () => qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() }),
  });
}

export function useDebloquerLivreur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (livreurId: UUID) => fournisseurMeApi.debloquerLivreur(livreurId),
    onSuccess: () => qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() }),
  });
}

/** Versement reçu : toutes les lectures du fournisseur (dû, commandes réglées, synthèse). */
export function useEnregistrerVersementFournisseur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EnregistrerVersementFournisseurRequest) => fournisseurMeApi.enregistrerVersement(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: fournisseurKeys.all }),
  });
}

/**
 * Accepter ou refuser, réussi ou non (un refus « n'est plus en attente » signale une liste
 * périmée) : la liste, le compteur (sous la clé des invitations) et les partenaires sont relus.
 */
function invaliderInvitations(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: fournisseurKeys.invitations() });
  qc.invalidateQueries({ queryKey: fournisseurKeys.partenaires() });
}

export function useAccepterInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => fournisseurMeApi.accepterInvitation(id),
    onSettled: () => invaliderInvitations(qc),
  });
}

export function useRefuserInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => fournisseurMeApi.refuserInvitation(id),
    onSettled: () => invaliderInvitations(qc),
  });
}
