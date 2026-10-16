import { format, parseISO } from 'date-fns';
import type { AuthResponse, EtatLocalisation } from '../../types/api';
import { estMembreOrganisation } from '../organisation/regles';

/** `yyyy-MM-ddTHH:mm:ss` (heure locale) → « 14:32 » ; vide si la date est illisible. */
export function heure(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = parseISO(iso);
  return Number.isNaN(date.getTime()) ? '' : format(date, 'HH:mm');
}

/** Vrai si la demande attend encore une réponse (l'heure d'expiration peut passer écran ouvert). */
export function enAttente(etat: EtatLocalisation | null | undefined, maintenant: Date): boolean {
  if (!etat || etat.statut !== 'EN_ATTENTE') return false;
  const limite = parseISO(etat.expireLe);
  return Number.isNaN(limite.getTime()) || limite.getTime() > maintenant.getTime();
}

/**
 * Lignes d'état d'une personne (mêmes libellés que le web) : « Partagée à 14:32 » dès qu'une
 * position du jour existe (même si une nouvelle demande est en attente, qui ajoute « En attente
 * de réponse… (expire à 14:47) »), puis « A refusé à 14:35 » ou « Sans réponse ».
 */
export function lignesEtat(etat: EtatLocalisation | null | undefined, maintenant: Date): string[] {
  if (!etat) return [];
  const lignes: string[] = [];
  if (etat.position) lignes.push(`Partagée à ${heure(etat.partageeLe)}`);
  if (etat.statut === 'ACCEPTEE') return lignes;
  if (enAttente(etat, maintenant)) {
    lignes.push(`En attente de réponse… (expire à ${heure(etat.expireLe)})`);
  } else if (etat.statut === 'REFUSEE') {
    lignes.push(`A refusé à ${heure(etat.reponduLe)}`);
  } else {
    // EXPIREE, ou EN_ATTENTE dont l'heure est passée
    lignes.push('Sans réponse');
  }
  return lignes;
}

/** Libellé d'état sur une ligne (les lignes de `lignesEtat` jointes par « · »). */
export function libelleEtat(etat: EtatLocalisation | null | undefined, maintenant: Date): string {
  return lignesEtat(etat, maintenant).join(' · ');
}

/** « près de Boutique Awa · Riviera 2 » ; vide sans repère. */
export function libelleRepere(repere: EtatLocalisation['repere'] | undefined): string {
  return repere ? `près de ${repere.client} · ${repere.quartier}` : '';
}

type UtilisateurLocalisation =
  | Pick<AuthResponse, 'parentId' | 'organisationId' | 'organisationRole'>
  | null
  | undefined;

/**
 * Accès à l'écran Localiser : responsable et commercial d'une organisation, ou livreur principal
 * indépendant (racine, hors organisation) qui a au moins un apprenti. Jamais un apprenti.
 */
export function peutLocaliser(user: UtilisateurLocalisation, nbApprentis: number): boolean {
  if (!user) return false;
  if (estMembreOrganisation(user)) return true;
  return !user.parentId && !user.organisationId && nbApprentis > 0;
}
