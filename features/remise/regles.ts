import type { Resultat } from '../commandes/regles';
import type { AuthResponse } from '../../types/api';

/**
 * D14 : seuls l'admin et le livreur racine (sans parentId) fixent une remise
 * convenue ; un apprenti l'applique sans pouvoir la changer.
 */
export function peutFixerRemise(user: Pick<AuthResponse, 'profile' | 'parentId'> | null): boolean {
  return !!user && (user.profile === 'ADMIN' || !user.parentId);
}

/**
 * Remise unitaire saisie : nombre >= 0, 2 décimales max, virgule ou point.
 * 0 est accepté (remise nulle explicite) ; champ vide = erreur.
 */
export function parseRemiseUnitaire(brut: string): Resultat<number> {
  const s = brut.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return { ok: false, erreur: 'Saisis une remise' };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) {
    return { ok: false, erreur: 'Remise invalide (nombre positif, 2 décimales maximum)' };
  }
  return { ok: true, valeur: Number(s) };
}
