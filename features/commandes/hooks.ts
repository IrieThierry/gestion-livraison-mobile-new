import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { commandesApi } from './api';
import { commandeKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { versementKeys } from '../versements/keys';
import { reversementKeys } from '../reversements/keys';
import type { ReceptionnerCommandeRequest, UUID } from '../../types/api';

export function useMesCommandes(enabled = true) {
  return useQuery({
    queryKey: commandeKeys.mes(),
    queryFn: commandesApi.mes,
    enabled,
  });
}

/** Désactivé tant qu'aucun fournisseur n'est choisi. */
export function useCommandesARegler(fournisseurId: UUID | undefined) {
  return useQuery({
    queryKey: commandeKeys.aRegler(fournisseurId ?? ''),
    queryFn: () => commandesApi.aRegler(fournisseurId!),
    enabled: !!fournisseurId,
    staleTime: 0,
  });
}

export function useCatalogueFournisseur(fournisseurId: UUID | undefined) {
  return useQuery({
    queryKey: commandeKeys.catalogue(fournisseurId ?? ''),
    queryFn: () => commandesApi.catalogue(fournisseurId!),
    enabled: !!fournisseurId,
    staleTime: 0,
  });
}

export function useCreerCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: commandesApi.creer,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
    // Refus du back (ligne désactivée, livreur bloqué) : on rafraîchit le catalogue.
    onError: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}

export function useAnnulerCommande() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => commandesApi.annuler(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: commandeKeys.all });
    },
  });
}

/** Détail d'une commande, lu par `GET /commande/{id}` (accessible à l'apprenti affecté). */
export function useCommande(id: UUID | undefined) {
  return useQuery({
    queryKey: commandeKeys.detail(id ?? ''),
    queryFn: () => commandesApi.detail(id!),
    enabled: !!id,
    staleTime: 0,
  });
}

/** Commandes à réceptionner (apprenti : seulement celles qui lui sont affectées). */
export function useCommandesAReceptionner(enabled = true) {
  return useQuery({
    queryKey: commandeKeys.aReceptionner(),
    queryFn: commandesApi.aReceptionner,
    enabled,
    staleTime: 0,
  });
}

/** Apprentis affectables chez ce fournisseur ; désactivé sans fournisseur. */
export function useApprentisAffectables(fournisseurId: UUID | undefined, enabled = true) {
  return useQuery({
    queryKey: commandeKeys.apprentisAffectables(fournisseurId ?? ''),
    queryFn: () => commandesApi.apprentisAffectables(fournisseurId!),
    enabled: enabled && !!fournisseurId,
    staleTime: 0,
  });
}

/**
 * Une réception, sa correction ou « Passer à Livrée » change la commande, le stock
 * de celui qui reçoit et les montants à régler (versements, reversements).
 */
function invaliderApresReception(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: commandeKeys.all });
  qc.invalidateQueries({ queryKey: stockKeys.all });
  qc.invalidateQueries({ queryKey: versementKeys.all });
  qc.invalidateQueries({ queryKey: reversementKeys.all });
}

/** Après un refus (400, 409 concurrent) : on recharge la commande pour repartir de données fraîches. */
function rechargerCommandes(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: commandeKeys.all });
}

export function useReceptionner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: UUID; payload: ReceptionnerCommandeRequest }) =>
      commandesApi.receptionner(id, payload),
    onSuccess: () => invaliderApresReception(qc),
    onError: () => rechargerCommandes(qc),
  });
}

export function useModifierReception() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      receptionId,
      payload,
    }: {
      id: UUID;
      receptionId: UUID;
      payload: ReceptionnerCommandeRequest;
    }) => commandesApi.modifierReception(id, receptionId, payload),
    onSuccess: () => invaliderApresReception(qc),
    onError: () => rechargerCommandes(qc),
  });
}

export function useAnnulerReception() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, receptionId }: { id: UUID; receptionId: UUID }) =>
      commandesApi.annulerReception(id, receptionId),
    onSuccess: () => invaliderApresReception(qc),
    onError: () => rechargerCommandes(qc),
  });
}

export function usePasserLivree() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => commandesApi.passerLivree(id),
    onSuccess: () => invaliderApresReception(qc),
    onError: () => rechargerCommandes(qc),
  });
}

export function useAffecterApprenti() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, apprentiId }: { id: UUID; apprentiId: UUID | null }) =>
      commandesApi.affecterApprenti(id, apprentiId),
    onSuccess: () => rechargerCommandes(qc),
    onError: () => rechargerCommandes(qc),
  });
}
