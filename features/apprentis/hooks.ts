import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apprentisApi } from './api';
import { apprentiKeys, demandesReinitialisationKeys } from './keys';
import { authApi } from '../auth/api';
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
      payload: Omit<CreerApprentiRequest, 'profile' | 'parentId'>,
    ) => {
      if (!user) throw new Error('Non authentifié');
      return apprentisApi.create({
        ...payload,
        profile: 'LIVREUR',
        parentId: user.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: apprentiKeys.all });
    },
  });
}

/**
 * M1 : demandes « Mot de passe oublié » en attente adressées au livreur
 * connecté (livreur principal ou responsable). Relue toutes les 30 s, comme
 * le fil de notifications.
 */
export function useDemandesReinitialisation(actif: boolean) {
  return useQuery({
    queryKey: demandesReinitialisationKeys.all,
    queryFn: authApi.demandesReinitialisation,
    enabled: actif,
    refetchInterval: actif ? 30_000 : false,
  });
}

/**
 * Réinitialisation du mot de passe d'un apprenti (route existante). La
 * demande en attente est traitée par le back : la liste est relue.
 */
export function useResetMotDePasse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => apprentisApi.resetPassword(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandesReinitialisationKeys.all });
      qc.invalidateQueries({ queryKey: apprentiKeys.all });
    },
  });
}

/** M1 : ignorer une demande « Mot de passe oublié » (fausse demande) : la liste est relue. */
export function useIgnorerDemandeReinitialisation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authApi.ignorerDemandeReinitialisation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: demandesReinitialisationKeys.all });
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
