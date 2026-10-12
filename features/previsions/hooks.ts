import { useMemo } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { previsionsApi } from './api';
import { previsionKeys } from './keys';
import { livraisonsApi } from '../livraisons/api';
import { livraisonKeys } from '../livraisons/keys';
import {
  ajouterPlusTard,
  cleStockagePlusTard,
  echuesATraiter,
  joursEchues,
  jourLocal,
  lireMemoirePlusTard,
  planCreation,
  planModification,
  planReport,
  regrouperPrevisions,
  type GroupePrevision,
  type MemoirePlusTard,
} from './regles';
import type { PrevisionResponse, UUID } from '../../types/api';

export { previsionKeys } from './keys';

/** Utilisateur réduit à ce qui décide des lectures (principal = sans parent). */
interface UtilisateurPrevisions {
  id: UUID;
  parentId?: UUID | null;
}

export function usePrevisionsLivreur(livreurId: UUID | undefined, date: string) {
  return useQuery({
    queryKey: previsionKeys.byLivreur(livreurId ?? '', date),
    queryFn: () => previsionsApi.byLivreur(livreurId as UUID, date),
    enabled: !!livreurId && !!date,
  });
}

/** Prévisions du principal ET de ses apprentis pour un jour (blocs apprentis, lecture seule). */
export function usePrevisionsParent(parentId: UUID | undefined, date: string, enabled = true) {
  return useQuery({
    queryKey: previsionKeys.byParent(parentId ?? '', date),
    queryFn: () => previsionsApi.byParent(parentId as UUID, date),
    enabled: enabled && !!parentId && !!date,
  });
}

/** Cumul par produit : du livreur seul, ou avec ses apprentis (`inclureApprentis`). */
export function useCumul(livreurId: UUID | undefined, date: string, inclureApprentis: boolean) {
  return useQuery({
    queryKey: inclureApprentis
      ? previsionKeys.cumulParent(livreurId ?? '', date)
      : previsionKeys.cumulLivreur(livreurId ?? '', date),
    queryFn: () =>
      inclureApprentis
        ? previsionsApi.cumulByParent(livreurId as UUID, date)
        : previsionsApi.cumulByLivreur(livreurId as UUID, date),
    enabled: !!livreurId && !!date,
  });
}

export function useCumulLivreur(livreurId: UUID | undefined, date: string) {
  return useCumul(livreurId, date, false);
}

/**
 * Livraisons d'un jour pour calculer le « Livré » : celles de l'équipe pour
 * un principal (lui + ses apprentis), les siennes pour un apprenti. Clés sous
 * `['livraisons']` : toute écriture de livraison les rafraîchit.
 */
export function useLivraisonsDuJour(user: UtilisateurPrevisions | null | undefined, jour: string) {
  const principal = !!user && !user.parentId;
  return useQuery({
    queryKey: principal
      ? livraisonKeys.byParentPeriode(user!.id, jour, jour)
      : livraisonKeys.byLivreurPeriode(user?.id ?? '', jour, jour),
    queryFn: () =>
      principal
        ? livraisonsApi.byParent(user!.id, { debut: jour, fin: jour })
        : livraisonsApi.byLivreur(user!.id, { debut: jour, fin: jour }),
    enabled: !!user && !!jour,
  });
}

// ---------------------------------------------------------------------------
// « Plus tard » (mémoire locale, par utilisateur)
// ---------------------------------------------------------------------------

export function useMemoirePlusTard(userId: UUID | undefined) {
  return useQuery({
    queryKey: previsionKeys.plusTard(userId ?? ''),
    queryFn: async (): Promise<MemoirePlusTard> => {
      try {
        return lireMemoirePlusTard(await AsyncStorage.getItem(cleStockagePlusTard(userId as UUID)));
      } catch {
        return {};
      }
    },
    enabled: !!userId,
    staleTime: Infinity,
  });
}

/** Mémorise « Plus tard » pour des groupes : ils ne sont plus comptés jusqu'au lendemain. */
export function usePlusTard(userId: UUID | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cles: string[]) => {
      if (!userId) return;
      const cle = cleStockagePlusTard(userId);
      let actuelle: MemoirePlusTard = {};
      try {
        actuelle = lireMemoirePlusTard(await AsyncStorage.getItem(cle));
      } catch {
        actuelle = {};
      }
      const suivante = ajouterPlusTard(actuelle, cles, jourLocal());
      qc.setQueryData(previsionKeys.plusTard(userId), suivante);
      try {
        await AsyncStorage.setItem(cle, JSON.stringify(suivante));
      } catch {
        // Stockage indisponible : le choix vaut pour la session.
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Échues (livreur connecté seulement)
// ---------------------------------------------------------------------------

export interface ResultatEchues {
  /** Échues à traiter (hors « Plus tard » du jour), de la plus ancienne à la plus récente. */
  echues: GroupePrevision[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Prévisions échues du livreur connecté (jamais celles des apprentis) :
 * jour < aujourd'hui et Reste > 0, sur les `JOURS_ECHUES` derniers jours.
 */
export function usePrevisionsEchues(userId: UUID | undefined, aujourdhui: string = jourLocal()): ResultatEchues {
  const jours = useMemo(() => joursEchues(aujourdhui), [aujourdhui]);
  const debut = jours[jours.length - 1];
  const fin = jours[0];
  const qPrev = useQueries({
    queries: jours.map((j) => ({
      queryKey: previsionKeys.byLivreur(userId ?? '', j),
      queryFn: () => previsionsApi.byLivreur(userId as UUID, j),
      enabled: !!userId,
    })),
  });
  const qLiv = useQuery({
    queryKey: livraisonKeys.byLivreurPeriode(userId ?? '', debut, fin),
    queryFn: () => livraisonsApi.byLivreur(userId as UUID, { debut, fin }),
    enabled: !!userId,
  });
  const qMemo = useMemoirePlusTard(userId);

  const cle = qPrev.map((q) => q.dataUpdatedAt).join('|');
  const echues = useMemo(() => {
    const previsions = qPrev.flatMap((q) => q.data ?? []);
    if (!qLiv.data) return [];
    return echuesATraiter(regrouperPrevisions(previsions, qLiv.data), qMemo.data ?? {}, aujourdhui);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle, qLiv.data, qMemo.data, aujourdhui]);

  return {
    echues,
    isLoading: qPrev.some((q) => q.isLoading) || qLiv.isLoading,
    isError: qPrev.some((q) => q.isError) || qLiv.isError,
    refetch: () => {
      for (const q of qPrev) q.refetch();
      qLiv.refetch();
    },
  };
}

// ---------------------------------------------------------------------------
// Écritures
// ---------------------------------------------------------------------------

function useInvaliderPrevisions() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: previsionKeys.all });
}

export interface SaisiePrevisions {
  livreurId: UUID;
  clientId: UUID;
  jour: string;
  commentaire?: string;
  lignes: Array<{ produitId: UUID; qte: number }>;
}

/**
 * Enregistre les quantités saisies : une prévision existante pour le même
 * client + produit + jour (du même livreur) est complétée (PUT, quantité
 * ajoutée) au lieu d'être dupliquée.
 */
export function useEnregistrerPrevisions() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async (s: SaisiePrevisions) => {
      // Lecture fraîche du jour (pas le cache) : décide ajout ou création.
      const existantes = await previsionsApi.byLivreur(s.livreurId, s.jour);
      for (const l of s.lignes) {
        const plan = planCreation(
          existantes,
          { livreurId: s.livreurId, clientId: s.clientId, produitId: l.produitId, jour: s.jour },
          l.qte,
        );
        if (plan.type === 'ajout') {
          await previsionsApi.update(plan.id, { qteEstimee: plan.qteEstimee });
        } else {
          await previsionsApi.create({
            livreurId: s.livreurId,
            clientId: s.clientId,
            produitId: l.produitId,
            qteEstimee: plan.qteEstimee,
            dateLivraison: s.jour,
            commentaire: s.commentaire,
          });
        }
      }
    },
    onSettled: () => invalider(),
  });
}

/** Ligne regroupée modifiée : la nouvelle quantité remplace le total (1re mise à jour, autres supprimées). */
export function useModifierGroupe() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async ({ groupe, qte }: { groupe: Pick<GroupePrevision, 'ids'>; qte: number }) => {
      const plan = planModification(groupe, qte);
      await previsionsApi.update(plan.maj.id, { qteEstimee: plan.maj.qteEstimee });
      for (const id of plan.suppressions) await previsionsApi.remove(id);
    },
    onSettled: () => invalider(),
  });
}

/** Supprime toutes les prévisions d'un ou plusieurs groupes. */
export function useSupprimerGroupes() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async (groupes: Array<Pick<GroupePrevision, 'ids'>>) => {
      for (const g of groupes) for (const id of g.ids) await previsionsApi.remove(id);
    },
    onSettled: () => invalider(),
  });
}

/**
 * Reporte des groupes échus à `jourCible` pour leur Reste : création (ou
 * complément) de la prévision du jour cible, puis suppression des
 * prévisions échues du groupe (le back ne change pas la date d'une prévision).
 */
export function useReporterGroupes() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async ({ groupes, jourCible }: { groupes: GroupePrevision[]; jourCible: string }) => {
      const parLivreur = new Map<UUID, PrevisionResponse[]>();
      for (const g of groupes) {
        if (g.reste <= 0) continue;
        if (!parLivreur.has(g.livreurId)) {
          parLivreur.set(g.livreurId, await previsionsApi.byLivreur(g.livreurId, jourCible));
        }
        const existantes = parLivreur.get(g.livreurId)!;
        const plan = planReport(g, jourCible, existantes);
        const creation = plan.creation;
        if (creation.type === 'ajout') {
          const maj = await previsionsApi.update(creation.id, { qteEstimee: creation.qteEstimee });
          // Plusieurs reports vers le même groupe : la quantité suivante s'ajoute à celle-ci.
          const i = existantes.findIndex((p) => p.id === creation.id);
          if (i >= 0) existantes[i] = { ...existantes[i], qteEstimee: maj?.qteEstimee ?? creation.qteEstimee };
        } else {
          const cree = await previsionsApi.create({
            livreurId: plan.cible.livreurId,
            clientId: plan.cible.clientId,
            produitId: plan.cible.produitId,
            qteEstimee: plan.creation.qteEstimee,
            dateLivraison: jourCible,
            commentaire: g.commentaire ?? undefined,
          });
          if (cree) existantes.push(cree);
        }
        for (const id of plan.suppressions) await previsionsApi.remove(id);
      }
    },
    onSettled: () => invalider(),
  });
}
