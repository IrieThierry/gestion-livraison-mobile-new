import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UUID } from '../../types/api';
import { relationsApi } from './api';
import { relationKeys } from './keys';
import { lookupKeys } from '../lookups/keys';

/** Annuaire des fournisseurs avec l'état de la relation du livreur (ou de sa racine). */
export function useMesFournisseurs() {
  return useQuery({
    queryKey: relationKeys.fournisseurs(),
    queryFn: relationsApi.fournisseurs,
  });
}

// Invite / annule : l'annuaire et la liste des partenaires (nouvelle commande) bougent.
function useInvalidation() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: relationKeys.all });
    qc.invalidateQueries({ queryKey: lookupKeys.partenaires });
  };
}

export function useInviterFournisseur() {
  const invalider = useInvalidation();
  return useMutation({
    mutationFn: (fournisseurId: UUID) => relationsApi.inviter(fournisseurId),
    onSuccess: invalider,
    // Après un échec (déjà en attente, déjà accepté...), on recharge l'état réel.
    onError: invalider,
  });
}

export function useAnnulerInvitation() {
  const invalider = useInvalidation();
  return useMutation({
    mutationFn: (relationId: UUID) => relationsApi.annuler(relationId),
    onSuccess: invalider,
    onError: invalider,
  });
}
