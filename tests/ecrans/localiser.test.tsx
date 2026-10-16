import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Localiser from '../../app/(livreur)/localiser';
import { apiClient } from '../../lib/api-client';
import { ouvrirItineraire } from '../../lib/linking';
import { useTempsReelStore } from '../../features/temps-reel/connexion';
import { INTERVALLE_MAINTENANT_MS } from '../../features/localisation/useMaintenant';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { WebView: () => <View testID="carte-positions" /> };
});
jest.mock('expo-router', () => ({
  usePathname: () => '/localiser',
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
  useFocusEffect: jest.fn(),
}));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
  revenirApresEnregistrement: jest.fn(),
  origineDe: jest.fn(() => null),
}));
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn(), choix: jest.fn() },
}));
jest.mock('../../lib/linking', () => ({ ouvrirItineraire: jest.fn(), callPhone: jest.fn(), navigateTo: jest.fn() }));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'liv-1', profile: 'LIVREUR', prenom: 'Ali', nom: 'Traoré', parentId: null } }),
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

const ETAT_PARTAGE = {
  demandeId: 'd1',
  statut: 'ACCEPTEE',
  creeLe: '2026-10-16T14:30:00',
  expireLe: '2026-10-16T14:45:00',
  reponduLe: '2026-10-16T14:32:00',
  position: '5.35,-4.01',
  partageeLe: '2026-10-16T14:32:00',
  repere: { client: 'Boutique Awa', quartier: 'Riviera 2' },
};

let personnes: unknown[] = [];

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Localiser />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  personnes = [{ id: 'p1', prenom: 'Awa', nom: 'Kone', photoUrl: null, etat: ETAT_PARTAGE }];
  get.mockImplementation(() => Promise.resolve({ data: personnes }));
  post.mockResolvedValue({ status: 201, data: { id: 'd2' } });
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  useTempsReelStore.setState({ connecte: false });
});

describe('Localiser', () => {
  it('liste : « Partagée à 14:32 », repère, Itinéraire et Redemander ; mini-carte', async () => {
    monter();
    expect(await screen.findByText('Awa Kone')).toBeTruthy();
    expect(screen.getByText('Partagée à 14:32')).toBeTruthy();
    expect(screen.getByText('près de Boutique Awa · Riviera 2')).toBeTruthy();
    expect(screen.getByTestId('carte-positions')).toBeTruthy();
    fireEvent.press(screen.getByText('Itinéraire'));
    expect(ouvrirItineraire).toHaveBeenCalledWith('5.35,-4.01');
  });

  it('« Redemander » : POST /localisation/demandes { cibleId }', async () => {
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Redemander'));
    });
    await waitFor(() => expect(post).toHaveBeenCalledWith('/localisation/demandes', { cibleId: 'p1' }));
  });

  it('en attente : « En attente de réponse… (expire à 14:47) » et Redemander désactivé', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 16, 14, 40, 0), advanceTimers: true });
    personnes = [
      {
        id: 'p1',
        prenom: 'Awa',
        nom: 'Kone',
        photoUrl: null,
        etat: { ...ETAT_PARTAGE, statut: 'EN_ATTENTE', expireLe: '2026-10-16T14:47:00', reponduLe: null },
      },
    ];
    monter();
    expect(await screen.findByText('En attente de réponse… (expire à 14:47)')).toBeTruthy();
    expect(screen.getByText('Partagée à 14:32')).toBeTruthy();
    const bouton = screen.getByRole('button', { name: 'Redemander' });
    expect(bouton).toBeDisabled();
    fireEvent.press(bouton);
    expect(post).not.toHaveBeenCalled();
  });

  it('personne sans demande du jour : « Demander sa position » ; erreur du back affichée', async () => {
    personnes = [{ id: 'p2', prenom: 'Moussa', nom: 'Bamba', photoUrl: null, etat: null }];
    post.mockRejectedValueOnce(
      Object.assign(new Error('x'), { response: { status: 400, data: { message: 'Une demande est déjà en attente.' } } }),
    );
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Demander sa position'));
    });
    expect(await screen.findByText('Une demande est déjà en attente.')).toBeTruthy();
    expect(screen.queryByText('Itinéraire')).toBeNull();
  });

  it('double appui sur « Redemander » : une seule demande envoyée', async () => {
    let terminer: (v: unknown) => void = () => {};
    post.mockImplementationOnce(() => new Promise((r) => (terminer = r)));
    monter();
    const bouton = await screen.findByText('Redemander');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });
    expect(post).toHaveBeenCalledTimes(1);
    await act(async () => terminer({ status: 201, data: { id: 'd2' } }));
  });

  it('socket connecté (pas de relecture) : Redemander se réactive après l’expiration grâce au tic de 30 s', async () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 16, 14, 46, 50), advanceTimers: true });
    useTempsReelStore.setState({ connecte: true });
    personnes = [
      {
        id: 'p1',
        prenom: 'Awa',
        nom: 'Kone',
        photoUrl: null,
        etat: { ...ETAT_PARTAGE, statut: 'EN_ATTENTE', expireLe: '2026-10-16T14:47:00', reponduLe: null },
      },
    ];
    monter();
    expect(await screen.findByText('En attente de réponse… (expire à 14:47)')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redemander' })).toBeDisabled();
    const lectures = get.mock.calls.length;
    await act(async () => {
      jest.advanceTimersByTime(INTERVALLE_MAINTENANT_MS);
    });
    expect(get.mock.calls.length).toBe(lectures);
    expect(screen.getByText('Sans réponse')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Redemander' })).not.toBeDisabled();
  });

  it('personne à localiser : aucune → message', async () => {
    personnes = [];
    monter();
    expect(await screen.findByText('Personne à localiser')).toBeTruthy();
  });
});
