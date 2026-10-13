import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transfertsApi } from './api';
import { stockKeys } from '../stock/keys';
import type { EffectuerTransfertRequest, UUID } from '../../types/api';
import { etatsKeys } from '../etats/keys';
import { organisationKeys } from '../organisation/keys';
import { useAuthStore } from '../../stores/authStore';

export const transfertKeys = {
  all: ['transferts'] as const,
  byLivreur: (id: UUID) => ['transferts', 'livreur', id] as const,
  byParent: (id: UUID) => ['transferts', 'parent', id] as const,
  aDecider: (id: UUID) => ['transferts', 'a-decider', id] as const,
};

export function useTransfertsLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: transfertKeys.byLivreur(livreurId ?? ''),
    queryFn: () => transfertsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

export function useTransfertsParent(parentId: UUID | undefined) {
  return useQuery({
    queryKey: transfertKeys.byParent(parentId ?? ''),
    queryFn: () => transfertsApi.byParent(parentId as UUID),
    enabled: !!parentId,
  });
}

/** Transferts en attente que le livreur connecté doit accepter ou refuser (cloche, Notifications). */
export function useTransfertsADecider() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  return useQuery({
    queryKey: transfertKeys.aDecider(userId),
    queryFn: () => transfertsApi.aDecider(),
    enabled: !!user,
    staleTime: 0,
  });
}

/**
 * Écriture sur les transferts : réussie ou non (un transfert « déjà traité »
 * signale une liste périmée), les transferts, le stock (courant, en transit,
 * historique, équipe) et les états sont relus.
 */
function useEcritureTransfert<V, R>(ecrire: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ecrire,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: transfertKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: etatsKeys.all });
      // Organisation : le statut du transfert d'un chargement se lit sur la demande.
      qc.invalidateQueries({ queryKey: organisationKeys.demandes() });
    },
  });
}

export const useEffectuerTransfert = () =>
  useEcritureTransfert((p: EffectuerTransfertRequest) => transfertsApi.effectuer(p));

export const useAccepterTransfert = () => useEcritureTransfert((id: UUID) => transfertsApi.accepter(id));

export const useRefuserTransfert = () =>
  useEcritureTransfert(({ id, motif }: { id: UUID; motif: string }) => transfertsApi.refuser(id, motif));

export const useAnnulerTransfert = () => useEcritureTransfert((id: UUID) => transfertsApi.annuler(id));
