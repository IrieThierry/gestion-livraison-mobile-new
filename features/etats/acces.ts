import type { LivreurResponse, UUID } from '../../types/api';
import { nomPersonne } from './calculs/commun';

export type FamilleEtat = 'ventes' | 'encaissements' | 'stock' | 'fournisseurs';

export interface DescriptionFamille {
  key: FamilleEtat;
  titre: string;
  description: string;
}

export const FAMILLES: DescriptionFamille[] = [
  {
    key: 'ventes',
    titre: 'Ventes / livraisons',
    description: 'Par livraison, par client et par produit',
  },
  {
    key: 'encaissements',
    titre: 'Encaissements et créances',
    description: 'Encaissements de la période et soldes clients',
  },
  {
    key: 'stock',
    titre: 'Stock et mouvements',
    description: 'Stock courant et mouvements par type',
  },
  {
    key: 'fournisseurs',
    titre: 'Fournisseurs et versements',
    description: 'Commandes, réceptions, versements et dû',
  },
];

export function estFamilleEtat(v: unknown): v is FamilleEtat {
  return FAMILLES.some((f) => f.key === v);
}

export function descriptionFamille(key: FamilleEtat): DescriptionFamille {
  return FAMILLES.find((f) => f.key === key) ?? FAMILLES[0];
}

/** Utilisateur connecté, réduit à ce qui décide de l'accès. */
export interface UtilisateurEtats {
  id: UUID;
  nom?: string | null;
  prenom?: string | null;
  parentId?: UUID | null;
}

/** Livreur principal = sans parent (même règle que le menu Profil). */
export function estPrincipal(user: UtilisateurEtats | null | undefined): boolean {
  return !!user && !user.parentId;
}

/** Familles proposées : l'apprenti n'a pas « Fournisseurs et versements ». */
export function famillesVisibles(user: UtilisateurEtats | null | undefined): DescriptionFamille[] {
  if (!user) return [];
  return estPrincipal(user) ? FAMILLES : FAMILLES.filter((f) => f.key !== 'fournisseurs');
}

export function peutVoirFamille(
  user: UtilisateurEtats | null | undefined,
  famille: FamilleEtat,
): boolean {
  return famillesVisibles(user).some((f) => f.key === famille);
}

/** Livreur ciblé par l'état : soi, l'équipe (principal + apprentis) ou un apprenti. */
export type ChoixLivreur =
  | { type: 'moi' }
  | { type: 'equipe' }
  | { type: 'apprenti'; id: UUID };

export const CHOIX_MOI: ChoixLivreur = { type: 'moi' };

/** Identifiant d'option du sélecteur. */
export function idChoix(choix: ChoixLivreur): string {
  return choix.type === 'apprenti' ? `apprenti:${choix.id}` : choix.type;
}

export function choixDepuisId(id: string | null | undefined): ChoixLivreur {
  if (id === 'equipe') return { type: 'equipe' };
  if (id && id.startsWith('apprenti:')) return { type: 'apprenti', id: id.slice('apprenti:'.length) };
  return CHOIX_MOI;
}

/** Le filtre livreur n'a de sens que pour un principal, hors famille fournisseurs. */
export function afficheFiltreLivreur(
  user: UtilisateurEtats | null | undefined,
  famille: FamilleEtat,
): boolean {
  return estPrincipal(user) && famille !== 'fournisseurs';
}

/** Options du sélecteur de livreur : principal → moi, équipe, chaque apprenti. */
export function optionsLivreur(
  user: UtilisateurEtats | null | undefined,
  apprentis: readonly Pick<LivreurResponse, 'id' | 'nom' | 'prenom'>[],
): Array<{ id: string; label: string }> {
  if (!user) return [];
  const moi = { id: 'moi', label: 'Moi' };
  if (!estPrincipal(user)) return [moi];
  return [
    moi,
    { id: 'equipe', label: 'Équipe (moi et mes apprentis)' },
    ...apprentis.map((a) => ({ id: idChoix({ type: 'apprenti', id: a.id }), label: nomPersonne(a) })),
  ];
}

/**
 * Choix réellement appliqué : un apprenti ne voit que ses propres données ;
 * un principal ne peut viser qu'un de SES apprentis ; la famille
 * fournisseurs porte toujours sur le principal lui-même.
 */
export function choixAutorise(
  user: UtilisateurEtats | null | undefined,
  choix: ChoixLivreur,
  apprentiIds: readonly UUID[],
  famille: FamilleEtat,
): ChoixLivreur {
  if (!estPrincipal(user) || famille === 'fournisseurs') return CHOIX_MOI;
  if (choix.type === 'apprenti' && !apprentiIds.includes(choix.id)) return CHOIX_MOI;
  return choix;
}

/** Cible des routes de lecture. */
export type CibleLecture =
  | { mode: 'livreur'; livreurId: UUID }
  | { mode: 'equipe'; parentId: UUID };

export function cibleLecture(user: UtilisateurEtats, choix: ChoixLivreur): CibleLecture {
  if (choix.type === 'equipe') return { mode: 'equipe', parentId: user.id };
  if (choix.type === 'apprenti') return { mode: 'livreur', livreurId: choix.id };
  return { mode: 'livreur', livreurId: user.id };
}

/** Libellé du livreur dans l'en-tête de l'état. */
export function libelleChoix(
  user: UtilisateurEtats,
  choix: ChoixLivreur,
  apprentis: readonly Pick<LivreurResponse, 'id' | 'nom' | 'prenom'>[],
): string {
  const moi = nomPersonne(user) || 'Moi';
  if (choix.type === 'equipe') return `Équipe de ${moi}`;
  if (choix.type === 'apprenti') {
    const a = apprentis.find((x) => x.id === choix.id);
    return a ? nomPersonne(a) : 'Apprenti';
  }
  return moi;
}
