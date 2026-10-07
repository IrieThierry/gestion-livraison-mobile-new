import type { Resultat } from '../commandes/regles';
import type { AuthResponse } from '../../types/api';

/**
 * D14/D20 : seuls l'admin et le livreur racine (sans parentId) fixent une remise
 * convenue, le statut avec/sans remise du client, son prix par défaut et ses
 * prix personnalisés ; un apprenti les voit en lecture seule.
 */
export function peutFixerConditions(user: Pick<AuthResponse, 'profile' | 'parentId'> | null): boolean {
  return !!user && (user.profile === 'ADMIN' || !user.parentId);
}

export const MESSAGE_REMISE_INVALIDE =
  'La remise doit être positive ou nulle, avec 2 décimales au plus.';

/**
 * D21 : remise unitaire du client saisie : nombre >= 0, 2 décimales max,
 * 12 chiffres entiers max, virgule ou point. 0 est accepté ; champ vide = erreur.
 */
export function parseRemiseUnitaire(brut: string): Resultat<number> {
  const s = brut.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return { ok: false, erreur: MESSAGE_REMISE_INVALIDE };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) {
    return { ok: false, erreur: MESSAGE_REMISE_INVALIDE };
  }
  return { ok: true, valeur: Number(s) };
}
