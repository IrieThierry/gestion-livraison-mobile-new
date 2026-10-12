import type { AbonnementMe, StatutAbonnement } from '../../types/api';

/** Message du bandeau, identique au message 403 du back (spec, section « Messages »). */
export const MESSAGE_ABONNEMENT_EXPIRE = 'Abonnement expiré : consultation seule.';

const LIBELLES: Record<StatutAbonnement, string> = {
  ESSAI: 'Essai gratuit',
  ACTIF: 'Actif',
  EXPIRE: 'Expiré — consultation seule',
};

/** Libellé de la ligne Abonnement de Moi → Mes infos (mêmes libellés que le Profil web). */
export function libelleAbonnement(statut: StatutAbonnement): string {
  return LIBELLES[statut] ?? statut;
}

/** Vrai seulement en EXPIRE ; sans abonnement (admin : 204) ou pas encore chargé = faux. */
export function estExpire(abonnement: Pick<AbonnementMe, 'statut'> | null | undefined): boolean {
  return abonnement?.statut === 'EXPIRE';
}
