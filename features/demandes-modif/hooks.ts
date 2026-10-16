import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { demandesModifApiDe, type RoleDemandes } from './api';
import { versementKeys } from '../versements/keys';
import { commandeKeys } from '../commandes/keys';
import { etatsKeys } from '../etats/keys';
import { fournisseurKeys } from '../fournisseur/keys';
import type { CreerDemandeModifVersementRequest, UUID } from '../../types/api';

export const demandeModifKeys = {
  all: ['demandes-modif-versement'] as const,
};

/**
 * Clé de la liste par rôle. Fournisseur : sous la racine de son espace (comme le web), à côté
 * de la liste « en attente » qui alimente le badge et « À traiter ».
 */
const cleListe = (role: RoleDemandes) =>
  role === 'fournisseur' ? fournisseurKeys.demandesModif() : demandeModifKeys.all;

/** Après une création ou un rejet : toutes les listes de demandes du rôle (badge compris). */
function invaliderDemandes(qc: QueryClient, role: RoleDemandes) {
  qc.invalidateQueries({
    queryKey: role === 'fournisseur' ? fournisseurKeys.demandesModifRacine() : demandeModifKeys.all,
  });
}

/** Demandes visibles (reçues et envoyées, tous statuts). */
export function useDemandesModif(enabled = true, role: RoleDemandes = 'livreur') {
  return useQuery({
    queryKey: cleListe(role),
    queryFn: demandesModifApiDe(role).lister,
    enabled,
  });
}

export function useCreerDemandeModif(role: RoleDemandes = 'livreur') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerDemandeModifVersementRequest) => demandesModifApiDe(role).creer(payload),
    onSuccess: () => invaliderDemandes(qc, role),
  });
}

/** Approuver : le versement est modifié et la chaîne de dette recalculée. */
export function useApprouverDemandeModif(role: RoleDemandes = 'livreur') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: UUID) => demandesModifApiDe(role).approuver(id),
    onSuccess: () => {
      if (role === 'fournisseur') {
        // Versements, dû des livreurs, synthèse : tout l'espace fournisseur est relu (comme le web).
        qc.invalidateQueries({ queryKey: fournisseurKeys.all });
        return;
      }
      qc.invalidateQueries({ queryKey: demandeModifKeys.all });
      qc.invalidateQueries({ queryKey: versementKeys.all });
      qc.invalidateQueries({ queryKey: commandeKeys.all });
      qc.invalidateQueries({ queryKey: etatsKeys.all });
    },
  });
}

export function useRejeterDemandeModif(role: RoleDemandes = 'livreur') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motif }: { id: UUID; motif: string }) => demandesModifApiDe(role).rejeter(id, motif),
    onSuccess: () => invaliderDemandes(qc, role),
  });
}
