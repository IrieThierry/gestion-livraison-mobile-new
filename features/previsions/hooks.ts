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

/**
 * Copie en mémoire (session) de la mémoire « Plus tard » de chaque
 * utilisateur : si AsyncStorage est indisponible, le choix vaut au moins
 * pour la session (relectures comprises).
 */
const memoireSession = new Map<UUID, MemoirePlusTard>();

/** Réservé aux tests : oublie les copies en mémoire. */
export function viderMemoireSessionPlusTard(): void {
  memoireSession.clear();
}

async function lirePlusTard(userId: UUID): Promise<MemoirePlusTard> {
  const session = memoireSession.get(userId) ?? {};
  try {
    const stocke = lireMemoirePlusTard(await AsyncStorage.getItem(cleStockagePlusTard(userId)));
    return { ...stocke, ...session };
  } catch {
    return session;
  }
}

export function useMemoirePlusTard(userId: UUID | undefined) {
  return useQuery({
    queryKey: previsionKeys.plusTard(userId ?? ''),
    queryFn: () => lirePlusTard(userId as UUID),
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
      const suivante = ajouterPlusTard(await lirePlusTard(userId), cles, jourLocal());
      memoireSession.set(userId, suivante);
      qc.setQueryData(previsionKeys.plusTard(userId), suivante);
      try {
        await AsyncStorage.setItem(cleStockagePlusTard(userId), JSON.stringify(suivante));
      } catch {
        // Stockage indisponible : la copie en mémoire vaut pour la session.
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
  /** Aucune échue calculable (livraisons illisibles, ou aucun jour lu). */
  isError: boolean;
  /** Certains jours n'ont pas pu être lus : la liste est incomplète. */
  partiel: boolean;
  refetch: () => void;
}

/**
 * Prévisions échues du livreur connecté (jamais celles des apprentis) :
 * jour < aujourd'hui et Reste > 0, sur les `JOURS_ECHUES` derniers jours.
 * Un jour illisible n'empêche pas d'afficher les autres (`partiel`).
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

  const joursEnErreur = qPrev.filter((q) => q.isError).length;
  return {
    echues,
    isLoading: qPrev.some((q) => q.isLoading) || qLiv.isLoading,
    isError: qLiv.isError || (joursEnErreur > 0 && joursEnErreur === qPrev.length),
    partiel: joursEnErreur > 0 && joursEnErreur < qPrev.length && !qLiv.isError,
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
  /** Appelé après chaque ligne écrite : le formulaire la retire (un nouvel essai ne la réécrit pas). */
  onLigneEcrite?: (produitId: UUID) => void;
}

/** Échec au milieu d'un enregistrement : lignes déjà écrites et ligne en échec. */
export class ErreurEnregistrementPartiel extends Error {
  constructor(
    readonly ecrites: UUID[],
    readonly enEchec: UUID,
    readonly cause: unknown,
  ) {
    super('Enregistrement partiel des prévisions');
    this.name = 'ErreurEnregistrementPartiel';
  }
}

/**
 * Enregistre les quantités saisies, une ligne après l'autre : une prévision
 * existante pour le même client + produit + jour (du même livreur) est
 * complétée (PUT, quantité ajoutée, commentaire saisi ajouté au sien) au lieu
 * d'être dupliquée. Sur échec, `ErreurEnregistrementPartiel` dit ce qui a
 * déjà été écrit.
 */
export function useEnregistrerPrevisions() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async (s: SaisiePrevisions) => {
      // Lecture fraîche du jour (pas le cache) : décide ajout ou création.
      const existantes = await previsionsApi.byLivreur(s.livreurId, s.jour);
      const ecrites: UUID[] = [];
      for (const l of s.lignes) {
        try {
          const plan = planCreation(
            existantes,
            { livreurId: s.livreurId, clientId: s.clientId, produitId: l.produitId, jour: s.jour },
            l.qte,
            s.commentaire,
          );
          if (plan.type === 'ajout') {
            await previsionsApi.update(
              plan.id,
              plan.commentaire ? { qteEstimee: plan.qteEstimee, commentaire: plan.commentaire } : { qteEstimee: plan.qteEstimee },
            );
          } else if (plan.type === 'creation') {
            await previsionsApi.create({
              livreurId: s.livreurId,
              clientId: s.clientId,
              produitId: l.produitId,
              qteEstimee: plan.qteEstimee,
              dateLivraison: s.jour,
              commentaire: plan.commentaire,
            });
          }
        } catch (e) {
          throw new ErreurEnregistrementPartiel(ecrites, l.produitId, e);
        }
        ecrites.push(l.produitId);
        s.onLigneEcrite?.(l.produitId);
      }
    },
    onSettled: () => invalider(),
  });
}

/** Ligne regroupée modifiée : la nouvelle quantité remplace le total (1re mise à jour, autres supprimées). */
export function useModifierGroupe() {
  const invalider = useInvaliderPrevisions();
  return useMutation({
    mutationFn: async ({
      groupe,
      qte,
    }: {
      groupe: Pick<GroupePrevision, 'ids'> & { commentaire?: string | null };
      qte: number;
    }) => {
      const plan = planModification(groupe, qte);
      await previsionsApi.update(
        plan.maj.id,
        plan.maj.commentaire
          ? { qteEstimee: plan.maj.qteEstimee, commentaire: plan.maj.commentaire }
          : { qteEstimee: plan.maj.qteEstimee },
      );
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
 * complément) de la prévision du jour cible, marquée « Reporté du JJ/MM »,
 * puis suppression des prévisions échues du groupe (le back ne change pas la
 * date d'une prévision). Un nouvel essai après un échec entre les deux ne
 * rajoute pas la quantité (marque déjà présente) : il refait la suppression.
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
          const maj = await previsionsApi.update(
            creation.id,
            creation.commentaire
              ? { qteEstimee: creation.qteEstimee, commentaire: creation.commentaire }
              : { qteEstimee: creation.qteEstimee },
          );
          // Plusieurs reports vers le même groupe : la quantité suivante s'ajoute à celle-ci.
          const i = existantes.findIndex((p) => p.id === creation.id);
          if (i >= 0) {
            existantes[i] = {
              ...existantes[i],
              qteEstimee: maj?.qteEstimee ?? creation.qteEstimee,
              commentaire: maj?.commentaire ?? creation.commentaire ?? existantes[i].commentaire,
            };
          }
        } else if (creation.type === 'creation') {
          const cree = await previsionsApi.create({
            livreurId: plan.cible.livreurId,
            clientId: plan.cible.clientId,
            produitId: plan.cible.produitId,
            qteEstimee: creation.qteEstimee,
            dateLivraison: jourCible,
            commentaire: creation.commentaire,
          });
          if (cree) existantes.push(cree);
        }
        for (const id of plan.suppressions) await previsionsApi.remove(id);
      }
    },
    onSettled: () => invalider(),
  });
}
