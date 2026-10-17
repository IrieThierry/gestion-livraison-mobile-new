import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { estProfilCommis } from '../../lib/navigation';
import { commisApi } from './api';
import type { LigneQuantiteRequest, UUID } from '../../types/api';

/**
 * Hooks de l'espace commis. Aucune requête n'est lancée pour un autre profil
 * (le back répondrait 403). Toute écriture relit l'espace entier (commandes,
 * remises, sorties, récapitulatif).
 */

export const commisKeys = {
  all: ['commis-me'] as const,
  commandes: (livreurId?: UUID) => [...commisKeys.all, 'commandes', livreurId ?? 'tous'] as const,
  livreurs: () => [...commisKeys.all, 'livreurs'] as const,
  catalogue: () => [...commisKeys.all, 'catalogue'] as const,
  remises: (commandeId: UUID) => [...commisKeys.all, 'remises', commandeId] as const,
  clients: () => [...commisKeys.all, 'clients'] as const,
  sorties: (date: string) => [...commisKeys.all, 'sorties', date] as const,
  recapitulatif: (date: string) => [...commisKeys.all, 'recapitulatif', date] as const,
};

function useEstCommis(): boolean {
  return useAuthStore((s) => estProfilCommis(s.user?.profile));
}

function useRelireEspace() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: commisKeys.all });
}

export function useCommandesCommis(livreurId?: UUID) {
  const actif = useEstCommis();
  return useQuery({
    queryKey: commisKeys.commandes(livreurId),
    queryFn: () => commisApi.commandes(livreurId),
    staleTime: 0,
    enabled: actif,
  });
}

export function useLivreursCommis() {
  const actif = useEstCommis();
  return useQuery({ queryKey: commisKeys.livreurs(), queryFn: commisApi.livreurs, staleTime: 60_000, enabled: actif });
}

export function useCatalogueCommis() {
  const actif = useEstCommis();
  return useQuery({ queryKey: commisKeys.catalogue(), queryFn: commisApi.catalogue, staleTime: 60_000, enabled: actif });
}

export function useRemisesCommande(commandeId: UUID | undefined) {
  const actif = useEstCommis();
  return useQuery({
    queryKey: commisKeys.remises(commandeId ?? ''),
    queryFn: () => commisApi.remisesCommande(commandeId!),
    staleTime: 0,
    enabled: actif && !!commandeId,
  });
}

export function useRemettre() {
  const relire = useRelireEspace();
  return useMutation({
    mutationFn: ({ commandeId, lignes }: { commandeId: UUID; lignes: LigneQuantiteRequest[] }) =>
      commisApi.remettre(commandeId, lignes),
    onSuccess: relire,
  });
}

export function useRemettreSansCommande() {
  const relire = useRelireEspace();
  return useMutation({
    mutationFn: ({ livreurId, lignes }: { livreurId: UUID; lignes: LigneQuantiteRequest[] }) =>
      commisApi.remettreSansCommande(livreurId, lignes),
    onSuccess: relire,
  });
}

export function useAnnulerRemise() {
  const relire = useRelireEspace();
  return useMutation({ mutationFn: (remiseId: UUID) => commisApi.annulerRemise(remiseId), onSuccess: relire });
}

export function useTerminerCommande() {
  const relire = useRelireEspace();
  return useMutation({ mutationFn: (commandeId: UUID) => commisApi.terminer(commandeId), onSuccess: relire });
}

export function useClientsCommis() {
  const actif = useEstCommis();
  return useQuery({ queryKey: commisKeys.clients(), queryFn: commisApi.clients, staleTime: 30_000, enabled: actif });
}

export function useSortiesDuJour(date: string) {
  const actif = useEstCommis();
  return useQuery({
    queryKey: commisKeys.sorties(date),
    queryFn: () => commisApi.sorties(date),
    staleTime: 0,
    enabled: actif && !!date,
  });
}

export function useSortir() {
  const relire = useRelireEspace();
  return useMutation({
    mutationFn: ({ clientId, lignes }: { clientId: UUID; lignes: LigneQuantiteRequest[] }) => commisApi.sortir(clientId, lignes),
    onSuccess: relire,
  });
}

export function useAnnulerSortie() {
  const relire = useRelireEspace();
  return useMutation({ mutationFn: (sortieId: UUID) => commisApi.annulerSortie(sortieId), onSuccess: relire });
}

export function useRecapitulatifCommis(date: string) {
  const actif = useEstCommis();
  return useQuery({
    queryKey: commisKeys.recapitulatif(date),
    queryFn: () => commisApi.recapitulatif(date),
    staleTime: 0,
    enabled: actif && !!date,
  });
}
