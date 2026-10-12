import {
  messageErreurConnexion,
  MSG_ERREUR_SERVEUR,
  MSG_HORS_LIGNE,
  MSG_IDENTIFIANTS,
  MSG_SERVEUR_INDISPONIBLE,
} from './erreurConnexion';

const reponse = (status: number, message?: unknown) => ({ response: { status, data: message === undefined ? {} : { message } } });

describe('messageErreurConnexion', () => {
  it('pas de réponse du serveur : serveur indisponible', () => {
    expect(messageErreurConnexion({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe(MSG_SERVEUR_INDISPONIBLE);
    expect(messageErreurConnexion({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' })).toBe(
      MSG_SERVEUR_INDISPONIBLE,
    );
    expect(messageErreurConnexion(new Error('connect ECONNREFUSED'))).toBe(MSG_SERVEUR_INDISPONIBLE);
    expect(messageErreurConnexion(undefined)).toBe(MSG_SERVEUR_INDISPONIBLE);
    expect(MSG_SERVEUR_INDISPONIBLE).toBe('Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard.');
  });

  it('téléphone hors ligne : pas de connexion internet', () => {
    expect(messageErreurConnexion({ code: 'ERR_NETWORK' }, { horsLigne: true })).toBe('Pas de connexion internet.');
    expect(MSG_HORS_LIGNE).toBe('Pas de connexion internet.');
  });

  it('401 du back pour un mauvais mot de passe : message standard', () => {
    expect(messageErreurConnexion(reponse(401, "Nom d'utilisateur ou mot de passe incorrect"))).toBe(
      'Identifiant ou mot de passe incorrect.',
    );
    expect(messageErreurConnexion(reponse(401))).toBe(MSG_IDENTIFIANTS);
    expect(messageErreurConnexion(reponse(403, 'Access Denied'))).toBe(MSG_IDENTIFIANTS);
    expect(messageErreurConnexion(reponse(400, 'could not execute statement; SQL [n/a]'))).toBe(MSG_IDENTIFIANTS);
  });

  it('message métier explicite : affiché tel quel', () => {
    expect(messageErreurConnexion(reponse(401, 'Compte désactivé. Contactez votre responsable.'))).toBe(
      'Compte désactivé. Contactez votre responsable.',
    );
    expect(messageErreurConnexion(reponse(400, { username: "Le nom d'utilisateur est obligatoire" }))).toBe(
      "Le nom d'utilisateur est obligatoire",
    );
  });

  it('5xx : erreur du serveur, même avec un message', () => {
    expect(messageErreurConnexion(reponse(500, 'NullPointerException'))).toBe('Erreur du serveur, réessayez plus tard.');
    expect(messageErreurConnexion(reponse(503))).toBe(MSG_ERREUR_SERVEUR);
  });
});
