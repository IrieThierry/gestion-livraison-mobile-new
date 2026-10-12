/**
 * Message affiché quand la connexion échoue (écran de connexion).
 *
 * | Cas                                                        | Message                                                              |
 * |------------------------------------------------------------|----------------------------------------------------------------------|
 * | Téléphone hors ligne (expo-network), pas de réponse        | « Pas de connexion internet. »                                       |
 * | Pas de réponse du serveur (back arrêté, DNS, délai…)       | « Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard. » |
 * | 5xx                                                        | « Erreur du serveur, réessayez plus tard. »                          |
 * | 4xx avec un message métier explicite (compte désactivé…)   | ce message                                                           |
 * | 4xx sinon (401 mot de passe refusé, message technique…)    | « Identifiant ou mot de passe incorrect. »                           |
 *
 * Le back répond 401 « Nom d'utilisateur ou mot de passe incorrect » pour un
 * mauvais mot de passe ou un identifiant inconnu (BadCredentialsException),
 * et 401 « Compte désactivé. Contactez votre responsable. » pour un compte
 * désactivé : le premier devient le message standard, le second est affiché
 * tel quel.
 */
export const MSG_HORS_LIGNE = 'Pas de connexion internet.';
export const MSG_SERVEUR_INDISPONIBLE = 'Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard.';
export const MSG_ERREUR_SERVEUR = 'Erreur du serveur, réessayez plus tard.';
export const MSG_IDENTIFIANTS = 'Identifiant ou mot de passe incorrect.';

/** Message refusant les identifiants, ou message technique : jamais affiché tel quel. */
const IDENTIFIANTS_OU_TECHNIQUE =
  /mot de passe incorrect|identifiants? incorrects?|bad credentials|unauthori[sz]ed|forbidden|access denied|full authentication|exception|sql|constraint|could not|stack|\bat [a-z]+\./i;

function texte(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (v && typeof v === 'object') {
    return Object.values(v as Record<string, unknown>)
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .join(' ; ');
  }
  return '';
}

export function messageErreurConnexion(err: unknown, opts: { horsLigne?: boolean } = {}): string {
  const e = err as { response?: { status?: number; data?: { message?: unknown } } } | null | undefined;
  const reponse = e?.response;
  // Pas de réponse : ERR_NETWORK, ECONNABORTED (délai), ECONNREFUSED, DNS…
  if (!reponse || typeof reponse.status !== 'number') {
    return opts.horsLigne ? MSG_HORS_LIGNE : MSG_SERVEUR_INDISPONIBLE;
  }
  if (reponse.status >= 500) return MSG_ERREUR_SERVEUR;
  const message = texte(reponse.data?.message);
  if (!message || message.length > 200 || IDENTIFIANTS_OU_TECHNIQUE.test(message)) return MSG_IDENTIFIANTS;
  return message;
}
