import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apprentisApi } from './api';
import { apprentiKeys } from './keys';
import { useAuthStore } from '../../stores/authStore';
import type { CreerApprentiRequest, UUID } from '../../types/api';

/**
 * Liste des apprentis du livreur connecté.
 *
 * Le hook s'auto-désactive si l'utilisateur n'est pas un livreur racine.
 * On relâche la condition à `!user.parentId` (au lieu de
 * `role === 'LIVREUR' && parentId == null`) pour gérer les sessions
 * legacy où `role` n'est pas renvoyé par le back — alignée avec la
 * gate du menu Profil et de la page apprentis.
 */
export function useApprentis() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const isRoot = !!user && !user.parentId;

  return useQuery({
    queryKey: apprentiKeys.list(userId),
    queryFn: () => apprentisApi.list(userId),
    enabled: isRoot,
  });
}

export function useCreerApprenti() {
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (
      payload: Omit<CreerApprentiRequest, 'role' | 'parentId'>,
    ) => {
      if (!user) throw new Error('Non authentifié');
      return apprentisApi.create({
        ...payload,
        role: 'LIVREUR',
        parentId: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apprentiKeys.all });
    },
  });
}

export function useToggleApprentiActif() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actif }: { id: UUID; actif: boolean }) =>
      apprentisApi.toggleActif(id, actif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apprentiKeys.all });
    },
  });
}
