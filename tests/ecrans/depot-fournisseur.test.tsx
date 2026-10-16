import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DepotFournisseur from '../../app/fournisseur/moi/depot';
import { apiClient } from '../../lib/api-client';
import { dialog } from '../../lib/dialog';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));
jest.mock('expo-router', () => ({
  usePathname: () => '/fournisseur/moi/depot',
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
jest.mock('../../components/livreur/MapPreview', () => {
  const { Text } = jest.requireActual('react-native');
  return { MapPreview: ({ lat, lng }: { lat: number; lng: number }) => <Text>{`apercu:${lat},${lng}`}</Text> };
});
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'F1', profile: 'FOURNISSEUR', prenom: 'A', nom: 'B' } }),
}));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;
const del = apiClient.delete as jest.Mock;
const demander = Location.requestForegroundPermissionsAsync as jest.Mock;
const lire = Location.getCurrentPositionAsync as jest.Mock;

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DepotFournisseur />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ status: 204, data: '' });
  put.mockResolvedValue({ data: {} });
  del.mockResolvedValue({ status: 204 });
  demander.mockResolvedValue({ status: 'granted' });
  lire.mockResolvedValue({ coords: { latitude: 5.3500004, longitude: -4.0099996 } });
});
afterEach(cleanup);

describe('Mon dépôt (fournisseur)', () => {
  it('demande la permission au tap, lit une fois, affiche l aperçu et enregistre', async () => {
    monter();
    await screen.findByText('Utiliser ma position actuelle');
    expect(demander).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText('Utiliser ma position actuelle'));
    });
    expect(demander).toHaveBeenCalledTimes(1);
    expect(lire).toHaveBeenCalledTimes(1);
    expect(screen.getByText('apercu:5.35,-4.01')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Enregistrer'));
    });
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/depot', { nom: 'Dépôt principal', position: '5.35,-4.01', adresse: null }),
    );
  });

  it('permission refusée : message et aucun PUT', async () => {
    demander.mockResolvedValue({ status: 'denied' });
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Utiliser ma position actuelle'));
    });
    expect(screen.getByText('Autorise la localisation pour utiliser ta position')).toBeTruthy();
    expect(lire).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
  });

  it('nom et adresse nettoyés, adresse vide donne null', async () => {
    monter();
    await act(async () => {
      fireEvent.press(await screen.findByText('Utiliser ma position actuelle'));
    });
    fireEvent.changeText(screen.getByLabelText('Nom du dépôt'), '  Entrepôt Nord ');
    fireEvent.changeText(screen.getByLabelText('Adresse du dépôt'), '  rue 12 ');
    await act(async () => {
      fireEvent.press(screen.getByText('Enregistrer'));
    });
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/depot', { nom: 'Entrepôt Nord', position: '5.35,-4.01', adresse: 'rue 12' }),
    );
  });

  it('dépôt existant : préremplit et Retirer le dépôt demande confirmation puis DELETE', async () => {
    get.mockResolvedValue({ status: 200, data: { id: 'd1', nom: 'Chez moi', position: '5.1,-4.2', adresse: 'Yop' } });
    monter();
    expect(await screen.findByDisplayValue('Chez moi')).toBeTruthy();
    expect(screen.getByText('apercu:5.1,-4.2')).toBeTruthy();
    fireEvent.press(screen.getByText('Retirer le dépôt'));
    const params = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(del).not.toHaveBeenCalled();
    await act(async () => {
      params.onConfirm();
    });
    await waitFor(() => expect(del).toHaveBeenCalledWith('/depot'));
  });
});
