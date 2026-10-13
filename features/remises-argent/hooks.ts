import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { remisesArgentApi } from './api';
import { remiseArgentKeys } from './keys';
import { organisationKeys } from '../organisation/keys';
import { useAuthStore } from '../../stores/authStore';
import type {
  ContesterRemiseArgentRequest,
  DeclarerRemiseArgentRequest,
  FiltresRemisesArgent,
  UUID,
} from '../../types/api';

export { remiseArgentKeys } from './keys';

/** Remises de l'apprenti connecté (désactivé pour un principal). */
export function useMesRemises() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: remiseArgentKeys.miennes(),
    queryFn: () => remisesArgentApi.miennes(),
    enabled: !!user?.parentId,
  });
}

/** Remises des apprentis du principal connecté (désactivé pour un apprenti). */
export function useRemisesApprentis(filtres: FiltresRemisesArgent = {}, enabled = true) {
  const user = useAuthStore((s) => s.user);
  const parentId = user?.id ?? '';
  return useQuery({
    queryKey: remiseArgentKeys.parent(parentId, filtres),
    queryFn: () => remisesArgentApi.parParent(parentId, filtres),
    enabled: enabled && !!user && !user.parentId,
  });
}

/** Remises déclarées à confirmer par le principal connecté (cloche, Notifications). */
export function useRemisesAConfirmer() {
  const user = useAuthStore((s) => s.user);
  const parentId = user?.id ?? '';
  const filtres: FiltresRemisesArgent = { statut: 'DECLAREE' };
  return useQuery({
    queryKey: remiseArgentKeys.parent(parentId, filtres),
    queryFn: () => remisesArgentApi.parParent(parentId, filtres),
    enabled: !!user && !user.parentId,
    staleTime: 0,
  });
}

function useEcritureRemise<V, R>(ecrire: (v: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ecrire,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: remiseArgentKeys.all });
      // Responsable : « Argent non remis » du tableau de bord.
      qc.invalidateQueries({ queryKey: organisationKeys.tableauxDeBord() });
    },
  });
}

export const useDeclarerRemise = () =>
  useEcritureRemise((p: DeclarerRemiseArgentRequest) => remisesArgentApi.declarer(p));

export const useAnnulerRemise = () => useEcritureRemise((id: UUID) => remisesArgentApi.annuler(id));

export const useConfirmerRemise = () => useEcritureRemise((id: UUID) => remisesArgentApi.confirmer(id));

export const useContesterRemise = () =>
  useEcritureRemise(({ id, motif }: { id: UUID } & ContesterRemiseArgentRequest) =>
    remisesArgentApi.contester(id, { motif }),
  );
