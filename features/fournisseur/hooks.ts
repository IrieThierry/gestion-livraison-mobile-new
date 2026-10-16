import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fournisseurMeApi } from './api';
import { fournisseurKeys } from './keys';

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
