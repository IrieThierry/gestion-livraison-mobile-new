import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transfertsApi } from './api';
import { stockKeys } from '../stock/keys';
import type { EffectuerTransfertRequest, UUID } from '../../types/api';

const transfertKeys = {
  all: ['transferts'] as const,
  byLivreur: (id: UUID) => ['transferts', 'livreur', id] as const,
  byParent: (id: UUID) => ['transferts', 'parent', id] as const,
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

export function useEffectuerTransfert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: EffectuerTransfertRequest) => transfertsApi.effectuer(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: transfertKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
    },
  });
}
