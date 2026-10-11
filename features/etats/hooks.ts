import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import type { LivreurResponse } from '../../types/api';
import { etatsApi } from './api';
import { etatsKeys } from './keys';
import { cibleLecture, type ChoixLivreur, type UtilisateurEtats } from './acces';
import { nomPersonne, type Periode } from './calculs/commun';
import { calculerEtatVentes } from './calculs/ventes';
import { calculerEtatEncaissements } from './calculs/encaissements';
import { calculerEtatStock, lignesDepuisActuel, lignesDepuisEquipe } from './calculs/stock';
import { calculerEtatFournisseurs } from './calculs/fournisseurs';
import {
  documentEncaissements,
  documentFournisseurs,
  documentStock,
  documentVentes,
  type DocumentEtat,
} from './document';

/** Paramètres communs : utilisateur, livreur choisi (déjà autorisé), période valide ou null. */
export interface ParamsEtat {
  user: UtilisateurEtats;
  choix: ChoixLivreur;
  /** Null tant que la période saisie est invalide : aucune lecture. */
  periode: Periode | null;
  libelleLivreur: string;
  apprentis: readonly LivreurResponse[];
  /** Lecture de la liste des apprentis (vue équipe : chargement et erreur remontés). */
  lectureApprentis: LectureApprentis;
}

/** État de la lecture des apprentis (`useApprentis`). */
export interface LectureApprentis {
  isSuccess: boolean;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  refetch: () => unknown;
}

export interface ResultatEtat {
  document: DocumentEtat | null;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  refetch: () => void;
}

type QueryLike = {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  isRefetching: boolean;
  refetch: () => unknown;
};

function combiner(queries: QueryLike[], document: DocumentEtat | null): ResultatEtat {
  const enErreur = queries.find((q) => q.isError);
  return {
    document,
    isLoading: queries.some((q) => q.isLoading),
    isError: !!enErreur,
    error: enErreur?.error ?? null,
    isRefetching: queries.some((q) => q.isRefetching),
    refetch: () => {
      for (const q of queries) q.refetch();
    },
  };
}

function entete(p: ParamsEtat, periode: Periode) {
  return {
    livreur: p.libelleLivreur,
    periode,
    editeLe: new Date(),
    equipe: p.choix.type === 'equipe',
  };
}

export function useEtatVentes(p: ParamsEtat): ResultatEtat {
  const cible = cibleLecture(p.user, p.choix);
  const periode = p.periode;
  const q = useQuery({
    queryKey: etatsKeys.livraisons(cible, periode),
    queryFn: () => etatsApi.livraisons(cible, periode!),
    enabled: !!periode,
  });
  const document = useMemo(
    () =>
      periode && q.data
        ? documentVentes(calculerEtatVentes(q.data, periode), entete(p, periode))
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [q.data, periode, p.libelleLivreur, p.choix.type],
  );
  return combiner([q], document);
}

export function useEtatEncaissements(p: ParamsEtat): ResultatEtat {
  const cible = cibleLecture(p.user, p.choix);
  const periode = p.periode;
  const qE = useQuery({
    queryKey: etatsKeys.encaissements(cible),
    queryFn: () => etatsApi.encaissements(cible),
    enabled: !!periode,
  });
  const qC = useQuery({
    queryKey: etatsKeys.encours(cible),
    queryFn: () => etatsApi.encours(cible),
    enabled: !!periode,
  });
  const document = useMemo(
    () =>
      periode && qE.data && qC.data
        ? documentEncaissements(
            calculerEtatEncaissements(qE.data, qC.data, periode),
            entete(p, periode),
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qE.data, qC.data, periode, p.libelleLivreur, p.choix.type],
  );
  return combiner([qE, qC], document);
}

export function useEtatStock(p: ParamsEtat): ResultatEtat {
  const periode = p.periode;
  const equipe = p.choix.type === 'equipe';
  // Vue équipe : la liste des apprentis doit être lue avant tout calcul, sinon
  // les mouvements des apprentis manqueraient en silence (PDF faux).
  const membresConnus = !equipe || p.lectureApprentis.isSuccess;
  const cible = cibleLecture(p.user, p.choix);
  const livreurId = cible.mode === 'livreur' ? cible.livreurId : p.user.id;

  // Membres dont on lit les mouvements : un seul livreur, ou le principal et ses apprentis.
  const membres = equipe
    ? [
        { id: p.user.id, nom: nomPersonne(p.user) },
        ...p.apprentis.map((a) => ({ id: a.id, nom: nomPersonne(a) })),
      ]
    : [{ id: livreurId, nom: '' }];

  const qStock = useQuery({
    queryKey: equipe ? etatsKeys.stockEquipe() : etatsKeys.stockLivreur(livreurId),
    queryFn: async () =>
      equipe
        ? lignesDepuisEquipe(await etatsApi.stockEquipe())
        : lignesDepuisActuel(await etatsApi.stockLivreur(livreurId)),
    enabled: !!periode && membresConnus,
  });
  const qMouvements = useQueries({
    queries: membres.map((mb) => ({
      queryKey: etatsKeys.mouvements(mb.id, periode),
      queryFn: () => etatsApi.mouvements(mb.id, periode!),
      enabled: !!periode && membresConnus,
    })),
  });

  // Clé stable (taille fixe) des données lues : évite un tableau de dépendances de taille variable.
  const cleMouvements = qMouvements
    .map((q, i) => `${membres[i].id}:${q.dataUpdatedAt}:${q.data ? 1 : 0}`)
    .join('|');
  const document = useMemo(
    () => {
      const donnees = qMouvements.map((q) => q.data);
      if (!periode || !membresConnus || !qStock.data || !donnees.every((d) => !!d)) return null;
      const mouvements = donnees.flatMap((d, i) =>
        (d ?? []).map((mv) => ({ ...mv, livreur: equipe ? membres[i].nom : undefined })),
      );
      return documentStock(calculerEtatStock(qStock.data, mouvements, periode), entete(p, periode));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qStock.data, cleMouvements, membresConnus, periode, p.libelleLivreur, p.choix.type],
  );
  return combiner(equipe ? [p.lectureApprentis, qStock, ...qMouvements] : [qStock, ...qMouvements], document);
}

export function useEtatFournisseurs(p: ParamsEtat): ResultatEtat {
  const periode = p.periode;
  const enabled = !!periode;
  const qP = useQuery({ queryKey: etatsKeys.partenaires(), queryFn: etatsApi.partenaires, enabled });
  const qC = useQuery({ queryKey: etatsKeys.commandes(), queryFn: etatsApi.commandes, enabled });
  const qV = useQuery({
    queryKey: etatsKeys.versements(p.user.id, periode),
    queryFn: () => etatsApi.versements(p.user.id, periode!),
    enabled,
  });
  const document = useMemo(
    () =>
      periode && qP.data && qC.data && qV.data
        ? documentFournisseurs(
            calculerEtatFournisseurs(qP.data, qC.data, qV.data, periode),
            entete(p, periode),
          )
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [qP.data, qC.data, qV.data, periode, p.libelleLivreur],
  );
  return combiner([qP, qC, qV], document);
}
