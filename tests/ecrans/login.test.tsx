import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { router } from 'expo-router';
import Login from '../../app/(auth)/login';
import { authApi } from '../../features/auth/api';
import { useDialogStore } from '../../stores/dialogStore';
import { Biometric } from '../../lib/biometric';
import { enregistrerChoixBiometrie, lireChoixBiometrie, oublierAncienChoixBiometrie } from '../../lib/biometrie-choix';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('../../features/auth/api', () => ({ authApi: { login: jest.fn() } }));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ setSession: jest.fn() }),
}));
jest.mock('../../lib/biometric', () => ({
  Biometric: { isAvailable: jest.fn(async () => false), getTypeLabel: jest.fn(async () => 'Face ID') },
}));
jest.mock('../../lib/biometrie-choix', () => ({
  lireChoixBiometrie: jest.fn(async () => null),
  oublierAncienChoixBiometrie: jest.fn(async () => undefined),
  enregistrerChoixBiometrie: jest.fn(async () => undefined),
}));
jest.mock('../../lib/secure-storage', () => ({ SecureStorage: { get: jest.fn(), set: jest.fn() } }));

const login = authApi.login as jest.Mock;
const etatReseau = Network.getNetworkStateAsync as jest.Mock;

function connecter(identifiant = 'awa', motDePasse = 'secret123') {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { gcTime: Infinity } } });
  render(
    <QueryClientProvider client={qc}>
      <Login />
    </QueryClientProvider>,
  );
  fireEvent.changeText(screen.getByPlaceholderText('ton.identifiant'), identifiant);
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), motDePasse);
  fireEvent.press(screen.getByText('Se connecter'));
}

async function messageAffiche(): Promise<string | undefined> {
  await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
  expect(useDialogStore.getState().title).toBe('Connexion impossible');
  return useDialogStore.getState().message;
}

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
  etatReseau.mockResolvedValue({ isConnected: true, isInternetReachable: true });
});

describe('Connexion : message d’erreur', () => {
  it('pas de réponse, téléphone sans connexion : « Pas de connexion internet. »', async () => {
    etatReseau.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    login.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    connecter();
    expect(await messageAffiche()).toBe('Pas de connexion internet.');
  });

  it('Wi-Fi intranet sans internet (isInternetReachable false), back arrêté : « Serveur indisponible… »', async () => {
    etatReseau.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    login.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    connecter();
    expect(await messageAffiche()).toBe('Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard.');
  });

  it('401 du back : « Identifiant ou mot de passe incorrect. », sans interroger le réseau', async () => {
    login.mockRejectedValue({
      response: { status: 401, data: { message: "Nom d'utilisateur ou mot de passe incorrect" } },
    });
    connecter();
    expect(await messageAffiche()).toBe('Identifiant ou mot de passe incorrect.');
    expect(etatReseau).not.toHaveBeenCalled();
  });
});

describe('Connexion : écran d’arrivée selon le profil', () => {
  const reponse = (profile: string) => ({
    token: 't',
    refreshToken: 'r',
    id: 'u-1',
    nom: 'Kone',
    prenom: 'Awa',
    username: 'awa',
    email: '',
    contact: '0712345678',
    profile,
  });

  it.each([
    ['LIVREUR', '/(livreur)'],
    ['ADMIN', '/portail-web'],
    ['FOURNISSEUR', '/portail-web'],
  ])('%s → %s', async (profile, cible) => {
    login.mockResolvedValue(reponse(profile));
    connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(cible));
  });
});

const reponseLivreur = {
  token: 't',
  refreshToken: 'r',
  id: 'u-1',
  nom: 'Kone',
  prenom: 'Awa',
  username: 'awa',
  email: '',
  contact: '0712345678',
  profile: 'LIVREUR',
};

describe('Connexion : identifiant sans espaces (S2)', () => {
  it('retire les espaces de l’identifiant, jamais du mot de passe', async () => {
    login.mockResolvedValue(reponseLivreur);
    connecter('  awa  ', ' secret123 ');
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(login.mock.calls[0][0]).toEqual({ username: 'awa', password: ' secret123 ' });
  });

  it('identifiant fait seulement d’espaces : refusé avant l’envoi', () => {
    connecter('   ', 'secret123');
    expect(login).not.toHaveBeenCalled();
    expect(useDialogStore.getState().message).toBe("Nom d'utilisateur requis");
  });
});

describe('Connexion : question de la biométrie (S4)', () => {
  const choix = lireChoixBiometrie as jest.Mock;
  const enregistrer = enregistrerChoixBiometrie as jest.Mock;
  beforeEach(() => {
    (Biometric.isAvailable as jest.Mock).mockResolvedValue(true);
    login.mockResolvedValue(reponseLivreur);
  });
  afterEach(() => (Biometric.isAvailable as jest.Mock).mockResolvedValue(false));

  const action = (label: string) => useDialogStore.getState().actions!.find((a) => a.label === label)!;

  it('première connexion, appareil compatible : « Plus tard » enregistre « refusee »', async () => {
    choix.mockResolvedValue(null);
    connecter();
    await waitFor(() => expect(useDialogStore.getState().title).toBe('Activer Face ID ?'));
    expect(choix).toHaveBeenCalledWith('awa');
    // Ancienne clé éventuelle : supprimée, jamais attribuée au compte qui se connecte.
    expect(oublierAncienChoixBiometrie).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await action('Plus tard').onPress!();
    expect(enregistrer).toHaveBeenCalledWith('awa', 'refusee');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
  });

  it('« Activer » enregistre « active »', async () => {
    choix.mockResolvedValue(null);
    connecter();
    await waitFor(() => expect(useDialogStore.getState().title).toBe('Activer Face ID ?'));
    await action('Activer').onPress!();
    expect(enregistrer).toHaveBeenCalledWith('awa', 'active');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
  });

  it.each([['refusee'], ['active']])('choix déjà fait (%s) : la question ne revient pas', async (c) => {
    choix.mockResolvedValue(c);
    connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    expect(useDialogStore.getState().open).toBe(false);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('appareil non compatible : aucune question', async () => {
    (Biometric.isAvailable as jest.Mock).mockResolvedValue(false);
    connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    expect(choix).not.toHaveBeenCalled();
    expect(useDialogStore.getState().open).toBe(false);
  });
});
