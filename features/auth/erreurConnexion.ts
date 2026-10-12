/**
 * Message affiché quand la connexion échoue (écran de connexion). Même règle
 * que le web (src/features/auth/erreur-connexion.ts), plus le cas hors ligne :
 *
 * | Cas                                                        | Message                                                              |
 * |------------------------------------------------------------|----------------------------------------------------------------------|
 * | Téléphone sans aucune connexion (isConnected === false)    | « Pas de connexion internet. »                                       |
 * | Pas de réponse du serveur (back arrêté, DNS, délai…)       | « Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard. » |
 * | 5xx « …User is disabled » (compte désactivé, back)         | « Compte désactivé. Contactez votre responsable. »                   |
 * | 5xx sinon                                                  | « Erreur du serveur, réessayez plus tard. »                          |
 * | 4xx avec un message métier de compte refusé (liste blanche)| ce message                                                           |
 * | 4xx sinon (mot de passe refusé, utilisateur inconnu…)      | « Identifiant ou mot de passe incorrect. »                           |
 *
 * Le back répond 401 « Nom d'utilisateur ou mot de passe incorrect » pour un
 * mauvais mot de passe ou un identifiant inconnu, et 401 « Compte désactivé.
 * Contactez votre responsable. » pour un compte désactivé. Seuls les messages
 * de la liste blanche (désactivé, en attente, bloqué, suspendu, verrouillé)
 * sont affichés tels quels : jamais un message qui révélerait si le compte
 * existe, ni un message technique.
 */
export const MSG_HORS_LIGNE = 'Pas de connexion internet.';
export const MSG_SERVEUR_INDISPONIBLE = 'Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard.';
export const MSG_ERREUR_SERVEUR = 'Erreur du serveur, réessayez plus tard.';
export const MSG_IDENTIFIANTS = 'Identifiant ou mot de passe incorrect.';
/** Compte désactivé : même libellé que le back (401) et le web. */
export const MSG_COMPTE_DESACTIVE = 'Compte désactivé. Contactez votre responsable.';

/** 500 du back sur /auth/login pour un compte désactivé (DisabledException de Spring non traitée). */
const COMPTE_DESACTIVE_SPRING = /user is disabled/i;

/** Message métier d'un compte refusé (liste blanche, comme le web). */
const MESSAGE_METIER = /d[ée]sactiv|attente|bloqu|suspendu|verrouill/i;

interface ErreurHttp {
  code?: string;
  response?: { status?: number; data?: { message?: unknown } };
}

/**
 * `horsLigne` : le téléphone n'a aucune connexion (`isConnected === false`).
 * L'API peut être sur un intranet sans accès internet : l'accessibilité
 * d'internet n'est jamais prise en compte.
 */
export function messageErreurConnexion(err: unknown, opts: { horsLigne?: boolean } = {}): string {
  const e = (err ?? {}) as ErreurHttp;
  const status = e.response?.status;
  if (e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT' || !e.response || !status) {
    return opts.horsLigne ? MSG_HORS_LIGNE : MSG_SERVEUR_INDISPONIBLE;
  }
  const message = e.response.data?.message;
  if (status >= 500) {
    return typeof message === 'string' && COMPTE_DESACTIVE_SPRING.test(message) ? MSG_COMPTE_DESACTIVE : MSG_ERREUR_SERVEUR;
  }
  if (typeof message === 'string' && MESSAGE_METIER.test(message)) return message.trim();
  return MSG_IDENTIFIANTS;
}
