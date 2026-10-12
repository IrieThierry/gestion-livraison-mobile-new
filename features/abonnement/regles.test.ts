import { estExpire, libelleAbonnement, MESSAGE_ABONNEMENT_EXPIRE } from './regles';

describe('Abonnement : libellés (comme sur le web)', () => {
  it('Essai gratuit, Actif, Expiré — consultation seule', () => {
    expect(libelleAbonnement('ESSAI')).toBe('Essai gratuit');
    expect(libelleAbonnement('ACTIF')).toBe('Actif');
    expect(libelleAbonnement('EXPIRE')).toBe('Expiré — consultation seule');
  });

  it('expiré seulement en EXPIRE ; pas d’abonnement (admin, 204) = pas expiré', () => {
    expect(estExpire({ statut: 'EXPIRE' })).toBe(true);
    expect(estExpire({ statut: 'ESSAI' })).toBe(false);
    expect(estExpire({ statut: 'ACTIF' })).toBe(false);
    expect(estExpire(null)).toBe(false);
    expect(estExpire(undefined)).toBe(false);
  });

  it('message du bandeau', () => {
    expect(MESSAGE_ABONNEMENT_EXPIRE).toBe('Abonnement expiré : consultation seule.');
  });
});
