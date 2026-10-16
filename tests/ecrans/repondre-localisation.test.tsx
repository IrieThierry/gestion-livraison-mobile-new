import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Location from 'expo-location';
import RepondreLocalisation from '../../app/(livreur)/localisation/[id]';
import { apiClient } from '../../lib/api-client';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn() },
}));
let mockId = 'd1';
jest.mock('expo-router', () => ({
  usePathname: () => '/localisation/d1',
  useLocalSearchParams: () => ({ id: mockId }),
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
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'c1', profile: 'LIVREUR', prenom: 'Awa', nom: 'Kone', parentId: 'r1' } }),
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const demander = Location.requestForegroundPermissionsAsync as jest.Mock;
const lire = Location.getCurrentPositionAsync as jest.Mock;

const DEMANDE = {
  id: 'd1',
  demandeurId: 'r1',
  demandeurNom: 'Ali Traoré',
  creeLe: '2026-10-16T14:30:00',
  expireLe: '2026-10-16T14:45:00',
};

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <RepondreLocalisation />
    </QueryClientProvider>,
  );
}

const erreurApi = (status: number, message: string) =>
  Object.assign(new Error(message), { response: { status, data: { message } } });

beforeEach(() => {
  jest.clearAllMocks();
  mockId = 'd1';
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/localisation/demandes/recues' ? [DEMANDE] : [] }),
  );
  post.mockResolvedValue({ status: 204 });
  demander.mockResolvedValue({ status: 'granted' });
  lire.mockResolvedValue({ coords: { latitude: 5.35, longitude: -4.01 } });
});
afterEach(cleanup);

describe('Répondre à une demande de localisation', () => {
  it('affiche le demandeur ; « Partager ma position » : une lecture GPS puis POST accepter', async () => {
    monter();
    expect(await screen.findByText('Ali Traoré demande ta position')).toBeTruthy();
    expect(demander).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.press(screen.getByText('Partager ma position'));
    });
    expect(lire).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith('/localisation/demandes/d1/accepter', { position: '5.35,-4.01' }),
    );
    expect(await screen.findByText('Position partagée.')).toBeTruthy();
    expect(screen.queryByText('Refuser')).toBeNull();
  });

  it('échec réseau : « Envoi impossible, réessaie » ; le nouvel essai relit le GPS', async () => {
    post.mockRejectedValueOnce(new Error('Network Error'));
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Partager ma position'));
    });
    expect(await screen.findByText('Envoi impossible, réessaie')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Partager ma position'));
    });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('400 « Cette demande a expiré. » : message affiché et boutons masqués', async () => {
    post.mockRejectedValueOnce(erreurApi(400, 'Cette demande a expiré.'));
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Partager ma position'));
    });
    expect(await screen.findByText('Cette demande a expiré.')).toBeTruthy();
    expect(screen.queryByText('Partager ma position')).toBeNull();
    expect(screen.queryByText('Refuser')).toBeNull();
  });

  it('permission refusée ou GPS muet : message, rien n est envoyé, la demande reste ouverte', async () => {
    demander.mockResolvedValueOnce({ status: 'denied' });
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Partager ma position'));
    });
    expect(screen.getByText('Autorise la localisation pour partager ta position')).toBeTruthy();
    expect(lire).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText('Refuser')).toBeTruthy();

    lire.mockRejectedValueOnce(new Error('DELAI'));
    await act(async () => {
      fireEvent.press(screen.getByText('Partager ma position'));
    });
    expect(screen.getByText('Position introuvable, réessaie')).toBeTruthy();
    expect(post).not.toHaveBeenCalled();
  });

  it('double appui sur « Partager ma position » : une seule lecture GPS et un seul POST', async () => {
    let fournir: (v: unknown) => void = () => {};
    lire.mockImplementationOnce(() => new Promise((r) => (fournir = r)));
    monter();
    const bouton = await screen.findByText('Partager ma position');
    await act(async () => {
      fireEvent.press(bouton);
      fireEvent.press(bouton);
    });
    await act(async () => fournir({ coords: { latitude: 5.35, longitude: -4.01 } }));
    expect(await screen.findByText('Position partagée.')).toBeTruthy();
    expect(lire).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('le verrou est libéré après un échec : le nouvel essai repart', async () => {
    lire.mockRejectedValueOnce(new Error('DELAI'));
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Partager ma position'));
    });
    expect(screen.getByText('Position introuvable, réessaie')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText('Partager ma position'));
    });
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('« Refuser » : POST refuser', async () => {
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Refuser'));
    });
    await waitFor(() => expect(post).toHaveBeenCalledWith('/localisation/demandes/d1/refuser'));
    expect(lire).not.toHaveBeenCalled();
    expect(await screen.findByText('Demande refusée.')).toBeTruthy();
  });

  it('demande absente des demandes reçues : expirée ou déjà traitée, sans boutons', async () => {
    mockId = 'autre';
    monter();
    expect(await screen.findByText('Cette demande a expiré ou a déjà reçu une réponse.')).toBeTruthy();
    expect(screen.queryByText('Partager ma position')).toBeNull();
    expect(screen.queryByText('Refuser')).toBeNull();
  });
});
