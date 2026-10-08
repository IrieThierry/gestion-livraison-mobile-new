import { useEffect, useState } from 'react';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type {
  ApercuEncaissementRequest,
  CreerEncaissementLivraisonRequest,
  UUID,
} from '../../types/api';
import { encaissementsApi } from './api';
import { encaissementKeys } from './keys';
import { peutValiderEncaissement } from './regles';
import { livraisonKeys } from '../livraisons/keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { reversementKeys } from '../reversements/keys';

/** Délai d'inactivité avant de rappeler l'aperçu serveur. */
export const DELAI_APERCU_MS = 300;

export function useEncaissementsByLivreur(livreurId: UUID | undefined) {
  return useQuery({
    queryKey: encaissementKeys.byLivreur(livreurId ?? ''),
    queryFn: () => encaissementsApi.byLivreur(livreurId as UUID),
    enabled: !!livreurId,
  });
}

/** Livraisons du client avec un reste dû, solde et avance (serveur). */
export function useLivraisonsAEncaisser(livreurId: UUID | undefined, clientId: UUID | null | undefined) {
  return useQuery({
    queryKey: encaissementKeys.aEncaisser(livreurId ?? '', clientId ?? ''),
    queryFn: () => encaissementsApi.aEncaisser(livreurId as UUID, clientId as UUID),
    enabled: !!livreurId && !!clientId,
  });
}

/** Valeur recopiée après `delaiMs` sans changement (comparaison par valeur). */
function useValeurDifferee<T>(valeur: T, delaiMs: number): T {
  const cle = JSON.stringify(valeur);
  const [differee, setDifferee] = useState(valeur);
  useEffect(() => {
    const t = setTimeout(() => setDifferee(valeur), delaiMs);
    return () => clearTimeout(t);
    // `cle` porte la valeur : un nouvel objet identique ne relance pas le délai.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, delaiMs]);
  return differee;
}

/**
 * Aperçu serveur de la répartition et de l'écart, rappelé après 300 ms
 * d'inactivité ; actif seulement avec au moins une livraison et un
 * montant > 0. L'aperçu précédent reste affiché pendant le rechargement.
 */
export function useApercuEncaissement(payload: ApercuEncaissementRequest | null) {
  const differe = useValeurDifferee(payload, DELAI_APERCU_MS);
  const actif =
    !!differe && peutValiderEncaissement(differe.livraisonIds, differe.montantEncaisse);
  return useQuery({
    queryKey: differe
      ? encaissementKeys.apercu(differe)
      : [...encaissementKeys.all, 'apercu', 'aucun'],
    queryFn: () => encaissementsApi.apercu(differe as ApercuEncaissementRequest),
    enabled: actif,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

/**
 * Encaissement d'un paiement client sur des livraisons cochées. Renvoie
 * l'encaissement créé par le serveur (écart, `detteApres`).
 * Invalide livraisons (statut et reste dû), encaissements (dont les
 * livraisons à encaisser et l'aperçu), encours, clients, remises et
 * reversements (une remise devient acquise quand la livraison est
 * entièrement payée).
 */
export function useCreerEncaissement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreerEncaissementLivraisonRequest) =>
      encaissementsApi.creer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
      // Remise « en attente » → « acquise » dans la synthèse reversements.
      qc.invalidateQueries({ queryKey: reversementKeys.all });
    },
  });
}
