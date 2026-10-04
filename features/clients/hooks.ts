import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from './api';
import { clientKeys, encoursKeys } from './keys';
import type {
  CreerClientRequest,
  ModifierClientRequest,
  UUID,
} from '../../types/api';

export function useClientsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: clientKeys.byLivreur(livreurId ?? ''),
    queryFn: () => clientsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

/** Encours (serveur) de tous les clients d'un livreur. */
export function useEncoursByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: encoursKeys.byLivreur(livreurId ?? ''),
    queryFn: () => clientsApi.encoursByLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

/** Encours (serveur) des clients de l'équipe d'un livreur parent. */
export function useEncoursByParent(parentId: UUID | undefined) {
  return useQuery({
    queryKey: encoursKeys.byParent(parentId ?? ''),
    queryFn: () => clientsApi.encoursByParent(parentId as UUID),
    enabled: !!parentId,
  });
}

/** Encours (serveur) d'un client. */
export function useEncoursClient(clientId: UUID | undefined | null) {
  return useQuery({
    queryKey: encoursKeys.client(clientId ?? ''),
    queryFn: () => clientsApi.encours(clientId as UUID),
    enabled: !!clientId,
  });
}

export function useEnregistrerClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerClientRequest) => clientsApi.enregistrer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
    },
  });
}

/**
 * Modifie un client. Invalide tout le sous-arbre `clients` au succès
 * pour que la liste, la fiche et le picker affichent immédiatement
 * les nouvelles infos ; et les encours (la limite de crédit, donc le
 * dépassement, a pu changer).
 */
export function useModifierClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ModifierClientRequest) => clientsApi.modifier(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
    },
  });
}
