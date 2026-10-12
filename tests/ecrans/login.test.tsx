import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { router } from 'expo-router';
import Login from '../../app/(auth)/login';
import { authApi } from '../../features/auth/api';
import { useDialogStore } from '../../stores/dialogStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('../../features/auth/api', () => ({ authApi: { login: jest.fn() } }));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ setSession: jest.fn() }),
}));
jest.mock('../../lib/biometric', () => ({ Biometric: { isAvailable: jest.fn(async () => false) } }));
jest.mock('../../lib/secure-storage', () => ({ SecureStorage: { get: jest.fn(), set: jest.fn() } }));

const login = authApi.login as jest.Mock;
const etatReseau = Network.getNetworkStateAsync as jest.Mock;

function connecter() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { gcTime: Infinity } } });
  render(
    <QueryClientProvider client={qc}>
      <Login />
    </QueryClientProvider>,
  );
  fireEvent.changeText(screen.getByPlaceholderText('ton.identifiant'), 'awa');
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'secret123');
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
