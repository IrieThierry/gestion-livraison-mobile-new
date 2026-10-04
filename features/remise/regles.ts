import type { Resultat } from '../commandes/regles';

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
