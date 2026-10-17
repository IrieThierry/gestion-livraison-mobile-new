import type { DepenseResponse, UUID } from '../../types/api';

/**
 * S5 : dépenses de l'équipe. Le livreur principal indépendant et le responsable
 * d'une organisation choisissent « Moi », « Équipe » (eux et leurs apprentis /
 * commerciaux) ou un apprenti / commercial actif. L'apprenti et le commercial
 * n'ont pas de sélecteur.
 */
export type CibleDepenses = { type: 'moi' } | { type: 'equipe' } | { type: 'apprenti'; id: UUID };

export const CIBLE_MOI: CibleDepenses = { type: 'moi' };

export interface OptionDepenses {
  id: string;
  label: string;
}

/** Identifiant d'option du sélecteur. */
export function idCible(c: CibleDepenses): string {
  return c.type === 'apprenti' ? `apprenti:${c.id}` : c.type;
}

export function cibleDepuisId(id: string | null | undefined): CibleDepenses {
  if (id === 'equipe') return { type: 'equipe' };
  if (id && id.startsWith('apprenti:')) return { type: 'apprenti', id: id.slice('apprenti:'.length) };
  return CIBLE_MOI;
}

/**
 * Options du sélecteur : vide (pas de sélecteur) pour un apprenti ou un
 * commercial ; sinon Moi, Équipe, puis les apprentis (commerciaux du responsable) actifs.
 * `libelleMembre` : libellé de repli d'un membre sans nom (« Apprenti » / « Commercial »).
 */
export function optionsDepenses(
  user: { id: UUID; parentId?: UUID | null } | null | undefined,
  commercial: boolean,
  apprentis: ReadonlyArray<{ id: UUID; nom?: string | null; prenom?: string | null; actif?: boolean }> | undefined,
  libelleMembre = 'Apprenti',
): OptionDepenses[] {
  if (!user || user.parentId || commercial) return [];
  const actifs = (apprentis ?? [])
    .filter((a) => a.actif !== false)
    .map((a) => ({
      id: idCible({ type: 'apprenti', id: a.id }),
      label: `${a.prenom ?? ''} ${a.nom ?? ''}`.replace(/\s+/g, ' ').trim() || libelleMembre,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  return [{ id: 'moi', label: 'Moi' }, { id: 'equipe', label: 'Équipe' }, ...actifs];
}

/** Cible réellement appliquée : une option proposée, sinon « Moi ». */
export function cibleRetenue(options: OptionDepenses[], cible: CibleDepenses): CibleDepenses {
  return options.some((o) => o.id === idCible(cible)) ? cible : CIBLE_MOI;
}

/** Paramètres de `GET /depense` : rien pour « Moi » (ses propres dépenses). */
export function filtreDepenses(c: CibleDepenses): { livreurId?: UUID; equipe?: boolean } {
  if (c.type === 'equipe') return { equipe: true };
  if (c.type === 'apprenti') return { livreurId: c.id };
  return {};
}

function proprietaireId(d: DepenseResponse): UUID | null {
  return d.proprietaire?.id ?? d.proprietaireUtilisateurId ?? null;
}

/** « par Awa TRAORÉ » quand l'auteur n'est pas l'utilisateur connecté (rien si le nom est inconnu). */
export function auteurDepense(d: DepenseResponse, userId: UUID): string | null {
  const id = proprietaireId(d);
  if (!id || id === userId) return null;
  const nom = d.proprietaire?.nom?.trim();
  return nom ? `par ${nom}` : null;
}

/** Seul l'auteur modifie ou supprime : les dépenses d'un apprenti sont en lecture seule. */
export function depenseModifiable(d: DepenseResponse, userId: UUID): boolean {
  const id = proprietaireId(d);
  return !id || id === userId;
}
