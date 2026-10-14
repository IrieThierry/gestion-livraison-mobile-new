import { SecureStorage } from './secure-storage';

/**
 * Choix de la biométrie (S4), mémorisé par identifiant dans le stockage
 * sécurisé. Il survit à la déconnexion : `clearAuth` n'efface que les jetons.
 *  - `active`  : déverrouillage biométrique au démarrage ;
 *  - `refusee` : « Plus tard » choisi, la question n'est plus reposée.
 * Pas de valeur : la question n'a jamais été posée pour ce compte sur ce téléphone.
 */
export type ChoixBiometrie = 'active' | 'refusee';

/** Ancienne clé (un seul booléen, effacé à la déconnexion), migrée vers la clé par identifiant. */
export const ANCIENNE_CLE_BIOMETRIE = 'biometric_enabled';

/**
 * Clé SecureStore pour un identifiant. SecureStore n'accepte que
 * `[A-Za-z0-9._-]` : les autres caractères sont encodés (`_xx`), et
 * l'identifiant est mis en minuscules (le back l'ignore à la connexion).
 */
export function cleChoixBiometrie(username: string): string {
  const normalise = username.trim().toLowerCase();
  const encode = Array.from(normalise)
    .map((c) => (/[a-z0-9.-]/.test(c) ? c : `_${c.codePointAt(0)!.toString(16)}`))
    .join('');
  return `biometrie_choix_${encode}`;
}

export async function lireChoixBiometrie(username: string): Promise<ChoixBiometrie | null> {
  const v = await SecureStorage.get(cleChoixBiometrie(username));
  return v === 'active' || v === 'refusee' ? v : null;
}

export async function enregistrerChoixBiometrie(username: string, choix: ChoixBiometrie): Promise<void> {
  await SecureStorage.set(cleChoixBiometrie(username), choix);
}

/**
 * Migration de l'ancienne clé `biometric_enabled = '1'` : elle n'existe que
 * si la session précédente n'a pas été déconnectée, donc pour le compte de
 * cette session. Elle devient `active` pour cet identifiant (sauf choix déjà
 * enregistré), puis est supprimée. Rend le choix à jour.
 */
export async function migrerAncienChoixBiometrie(username: string): Promise<ChoixBiometrie | null> {
  const actuel = await lireChoixBiometrie(username);
  const ancien = await SecureStorage.get(ANCIENNE_CLE_BIOMETRIE);
  if (ancien === null || ancien === undefined) return actuel;
  await SecureStorage.remove(ANCIENNE_CLE_BIOMETRIE);
  if (actuel === null && ancien === '1') {
    await enregistrerChoixBiometrie(username, 'active');
    return 'active';
  }
  return actuel;
}
