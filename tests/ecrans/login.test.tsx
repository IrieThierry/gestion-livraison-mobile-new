import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import Login from '../../app/(auth)/login';
import { authApi } from '../../features/auth/api';
import { useDialogStore } from '../../stores/dialogStore';
import { Biometric } from '../../lib/biometric';
import { enregistrerChoixBiometrie, lireChoixBiometrie, oublierAncienChoixBiometrie } from '../../lib/biometrie-choix';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.0.0' } } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('expo-network', () => ({ getNetworkStateAsync: jest.fn() }));
jest.mock('../../features/auth/api', () => ({ authApi: { login: jest.fn() } }));
const mockAuthState = {
  setSession: jest.fn(),
  deverrouillageBiometriquePossible: jest.fn(async () => false),
  deverrouillerParBiometrie: jest.fn(async (): Promise<unknown> => null),
};
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockAuthState),
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

async function connecter(identifiant = 'awa', motDePasse = 'secret123') {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity }, queries: { gcTime: Infinity } } });
  render(
    <QueryClientProvider client={qc}>
      <Login />
    </QueryClientProvider>,
  );
  // Effet asynchrone (bouton biométrique possible ?) : laissé se terminer dans act().
  await act(async () => {});
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

// La mutation notifie l'écran par un minuteur (notifyManager de TanStack Query)
// après la navigation : ces mises à jour sont terminées dans act().
async function laisserFinir() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 10));
  });
}

afterEach(laisserFinir);

describe('Connexion : message d’erreur', () => {
  it('pas de réponse, téléphone sans connexion : « Pas de connexion internet. »', async () => {
    etatReseau.mockResolvedValue({ isConnected: false, isInternetReachable: false });
    login.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    await connecter();
    expect(await messageAffiche()).toBe('Pas de connexion internet.');
  });

  it('Wi-Fi intranet sans internet (isInternetReachable false), back arrêté : « Serveur indisponible… »', async () => {
    etatReseau.mockResolvedValue({ isConnected: true, isInternetReachable: false });
    login.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
    await connecter();
    expect(await messageAffiche()).toBe('Serveur indisponible. Vérifiez votre connexion ou réessayez plus tard.');
  });

  it('401 du back : « Identifiant ou mot de passe incorrect. », sans interroger le réseau', async () => {
    login.mockRejectedValue({
      response: { status: 401, data: { message: "Nom d'utilisateur ou mot de passe incorrect" } },
    });
    await connecter();
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
    await connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith(cible));
    await laisserFinir();
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
    await connecter('  awa  ', ' secret123 ');
    await waitFor(() => expect(login).toHaveBeenCalled());
    expect(login.mock.calls[0][0]).toEqual({ username: 'awa', password: ' secret123 ' });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
  });

  it('identifiant fait seulement d’espaces : refusé avant l’envoi', async () => {
    await connecter('   ', 'secret123');
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
    await connecter();
    await waitFor(() => expect(useDialogStore.getState().title).toBe('Activer Face ID ?'));
    expect(choix).toHaveBeenCalledWith('awa');
    // Ancienne clé éventuelle : supprimée, jamais attribuée au compte qui se connecte.
    expect(oublierAncienChoixBiometrie).toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
    await act(async () => {
      await action('Plus tard').onPress!();
    });
    expect(enregistrer).toHaveBeenCalledWith('awa', 'refusee');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
  });

  it('« Activer » enregistre « active »', async () => {
    choix.mockResolvedValue(null);
    await connecter();
    await waitFor(() => expect(useDialogStore.getState().title).toBe('Activer Face ID ?'));
    await act(async () => {
      await action('Activer').onPress!();
    });
    expect(enregistrer).toHaveBeenCalledWith('awa', 'active');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
  });

  it.each([['refusee'], ['active']])('choix déjà fait (%s) : la question ne revient pas', async (c) => {
    choix.mockResolvedValue(c);
    await connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
    expect(useDialogStore.getState().open).toBe(false);
    expect(enregistrer).not.toHaveBeenCalled();
  });

  it('appareil non compatible : aucune question', async () => {
    (Biometric.isAvailable as jest.Mock).mockResolvedValue(false);
    await connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
    expect(choix).not.toHaveBeenCalled();
    expect(useDialogStore.getState().open).toBe(false);
  });
});

describe('Connexion : écran à bandeau vert', () => {
  async function afficher() {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Login />
      </QueryClientProvider>,
    );
    // Effet asynchrone (bouton biométrique possible ?) : laissé se terminer dans act().
    await act(async () => {});
  }

  it('bandeau « Bon retour », lien « Créer un compte » vers l’inscription', async () => {
    await afficher();
    expect(screen.getByText('Bon retour')).toBeTruthy();
    expect(screen.getByTestId('bandeau-connexion')).toBeTruthy();
    expect(screen.getByText('Version 1.0.0')).toBeTruthy();
    fireEvent.press(screen.getByText('Créer un compte'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/signup');
  });

  it('afficher / masquer le mot de passe', async () => {
    await afficher();
    const champ = () => screen.getByPlaceholderText('••••••••');
    expect(champ().props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByLabelText('Afficher le mot de passe'));
    expect(champ().props.secureTextEntry).toBe(false);
    fireEvent.press(screen.getByLabelText('Masquer le mot de passe'));
    expect(champ().props.secureTextEntry).toBe(true);
  });

  it('bouton biométrique absent quand il ne peut pas marcher', async () => {
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(false);
    await afficher();
    await waitFor(() => expect(mockAuthState.deverrouillageBiometriquePossible).toHaveBeenCalled());
    expect(screen.queryByText('Empreinte ou Face ID')).toBeNull();
  });

  it('bouton biométrique : déverrouille la session gardée et ouvre l’accueil du profil', async () => {
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(true);
    mockAuthState.deverrouillerParBiometrie.mockResolvedValue(reponseLivreur);
    await afficher();
    fireEvent.press(await screen.findByText('Empreinte ou Face ID'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    await laisserFinir();
  });

  it('biométrie refusée : on reste sur la connexion', async () => {
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(true);
    mockAuthState.deverrouillerParBiometrie.mockResolvedValue(null);
    await afficher();
    fireEvent.press(await screen.findByText('Empreinte ou Face ID'));
    await waitFor(() => expect(mockAuthState.deverrouillerParBiometrie).toHaveBeenCalled());
    expect(router.replace).not.toHaveBeenCalled();
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(false);
  });
});

describe('Connexion : accessibilité', () => {
  it('« Bon retour » est un titre ; « Se connecter » annonce « occupé » pendant l’envoi', async () => {
    login.mockReturnValue(new Promise(() => undefined));
    await connecter();
    expect(screen.getByRole('header', { name: 'Bon retour' })).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByLabelText('Se connecter').props.accessibilityState).toEqual({
        disabled: true,
        busy: true,
      }),
    );
    expect(screen.getByLabelText('Connexion en cours')).toBeTruthy();
  });
});

describe('Connexion : « Se souvenir de moi » et « Mot de passe oublié » (M1, M2)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(false);
  });

  async function afficher() {
    const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <Login />
      </QueryClientProvider>,
    );
    await act(async () => {});
  }

  it('case cochée par défaut : session gardée et identifiant mémorisé', async () => {
    login.mockResolvedValue(reponseLivreur);
    await connecter();
    expect(screen.getByRole('checkbox', { name: 'Se souvenir de moi' }).props.accessibilityState).toEqual({ checked: true });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    expect(mockAuthState.setSession).toHaveBeenCalledWith('t', 'r', expect.objectContaining({ username: 'awa' }), true);
    expect(await AsyncStorage.getItem('identifiant_memorise')).toBe('awa');
    await laisserFinir();
  });

  it('case décochée : jetons en mémoire seulement, identifiant oublié, pas de question biométrie', async () => {
    (Biometric.isAvailable as jest.Mock).mockResolvedValue(true);
    await AsyncStorage.setItem('identifiant_memorise', 'ancien');
    login.mockResolvedValue(reponseLivreur);
    await afficher();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Se souvenir de moi' }));
    fireEvent.changeText(screen.getByPlaceholderText('ton.identifiant'), 'awa');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'secret123');
    fireEvent.press(screen.getByText('Se connecter'));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    expect(mockAuthState.setSession).toHaveBeenCalledWith('t', 'r', expect.anything(), false);
    expect(await AsyncStorage.getItem('identifiant_memorise')).toBeNull();
    expect(lireChoixBiometrie).not.toHaveBeenCalled();
    (Biometric.isAvailable as jest.Mock).mockResolvedValue(false);
    await laisserFinir();
  });

  it('identifiant mémorisé prérempli', async () => {
    await AsyncStorage.setItem('identifiant_memorise', 'awa');
    await afficher();
    await waitFor(() => expect(screen.getByPlaceholderText('ton.identifiant').props.value).toBe('awa'));
  });

  it('case décochée : bouton biométrique masqué', async () => {
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(true);
    await afficher();
    expect(await screen.findByText('Empreinte ou Face ID')).toBeTruthy();
    fireEvent.press(screen.getByRole('checkbox', { name: 'Se souvenir de moi' }));
    expect(screen.queryByText('Empreinte ou Face ID')).toBeNull();
    mockAuthState.deverrouillageBiometriquePossible.mockResolvedValue(false);
  });

  it('lien « Mot de passe oublié ? » vers l’écran de demande', async () => {
    await afficher();
    fireEvent.press(screen.getByText('Mot de passe oublié ?'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/mot-de-passe-oublie');
  });

  it('mot de passe provisoire : ouvre « Choisis ton nouveau mot de passe »', async () => {
    login.mockResolvedValue({ ...reponseLivreur, motDePasseProvisoire: true });
    await connecter();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/mot-de-passe-provisoire'));
    await laisserFinir();
  });
});
