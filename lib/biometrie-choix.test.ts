import * as SecureStore from 'expo-secure-store';
import { SecureStorage } from './secure-storage';
import {
  cleChoixBiometrie,
  enregistrerChoixBiometrie,
  lireChoixBiometrie,
  migrerAncienChoixBiometrie,
  oublierAncienChoixBiometrie,
} from './biometrie-choix';

// expo-secure-store : magasin en mémoire (jest.setup.js).

beforeEach(() => {
  // Magasin en mémoire partagé : vidé entre les tests.
  (SecureStore as unknown as { __vider: () => void }).__vider();
});

describe('S4 : choix de la biométrie par identifiant', () => {
  it('clé valide pour SecureStore, insensible à la casse et aux espaces, sans collision', () => {
    expect(cleChoixBiometrie('Awa')).toBe('biometrie_choix_awa');
    expect(cleChoixBiometrie(' awa ')).toBe('biometrie_choix_awa');
    expect(cleChoixBiometrie('a@b')).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(cleChoixBiometrie('a_b')).not.toBe(cleChoixBiometrie('a@b'));
  });

  it('enregistré par compte : le choix d’un compte ne touche pas l’autre', async () => {
    expect(await lireChoixBiometrie('awa')).toBeNull();
    await enregistrerChoixBiometrie('awa', 'active');
    await enregistrerChoixBiometrie('ali', 'refusee');
    expect(await lireChoixBiometrie('awa')).toBe('active');
    expect(await lireChoixBiometrie('ali')).toBe('refusee');
  });

  it('la déconnexion (clearAuth) efface les jetons, pas le choix', async () => {
    await SecureStorage.set('access_token', 't');
    await SecureStorage.set('refresh_token', 'r');
    await enregistrerChoixBiometrie('awa', 'active');
    await SecureStorage.clearAuth();
    expect(await SecureStorage.get('access_token')).toBeNull();
    expect(await SecureStorage.get('refresh_token')).toBeNull();
    expect(await lireChoixBiometrie('awa')).toBe('active');
  });

  it('migration : l’ancienne clé « 1 » devient « active » pour le compte, puis disparaît', async () => {
    await SecureStorage.set('biometric_enabled', '1');
    expect(await migrerAncienChoixBiometrie('awa')).toBe('active');
    expect(await lireChoixBiometrie('awa')).toBe('active');
    expect(await SecureStorage.get('biometric_enabled')).toBeNull();
  });

  it('migration : un choix déjà enregistré est conservé ; sans ancienne clé rien ne change', async () => {
    await enregistrerChoixBiometrie('awa', 'refusee');
    await SecureStorage.set('biometric_enabled', '1');
    expect(await migrerAncienChoixBiometrie('awa')).toBe('refusee');
    expect(await SecureStorage.get('biometric_enabled')).toBeNull();
    expect(await migrerAncienChoixBiometrie('ali')).toBeNull();
  });

  it('ancienne clé restante à la connexion d’un autre compte : supprimée, attribuée à personne', async () => {
    await SecureStorage.set('biometric_enabled', '1');
    await oublierAncienChoixBiometrie();
    expect(await SecureStorage.get('biometric_enabled')).toBeNull();
    expect(await lireChoixBiometrie('ali')).toBeNull();
    expect(await lireChoixBiometrie('awa')).toBeNull();
    // Sans ancienne clé : rien ne change.
    await enregistrerChoixBiometrie('ali', 'active');
    await oublierAncienChoixBiometrie();
    expect(await lireChoixBiometrie('ali')).toBe('active');
  });

  it('magasin vidé entre les tests : aucun choix hérité', async () => {
    expect(await lireChoixBiometrie('awa')).toBeNull();
    expect(await lireChoixBiometrie('ali')).toBeNull();
  });
});
