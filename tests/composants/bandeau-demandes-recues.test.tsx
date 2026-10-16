import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BandeauDemandesRecues } from '../../components/localisation/BandeauDemandesRecues';
import { apiClient } from '../../lib/api-client';
import { ouvrir } from '../../lib/navigation-app';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-router', () => ({ useFocusEffect: jest.fn(), router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../../lib/navigation-app', () => ({ ouvrir: jest.fn(), naviguer: jest.fn() }));

const get = apiClient.get as jest.Mock;

function monter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BandeauDemandesRecues />
    </QueryClientProvider>,
  );
}

beforeEach(() => jest.clearAllMocks());
afterEach(cleanup);

describe('Bandeau des demandes de position reçues (accueil)', () => {
  it('une ligne par demande en attente ; appui → écran de réponse', async () => {
    get.mockResolvedValue({
      data: [{ id: 'd1', demandeurId: 'r1', demandeurNom: 'Ali Traoré', creeLe: '2026-10-16T14:30:00', expireLe: '2026-10-16T14:45:00' }],
    });
    monter();
    fireEvent.press(await screen.findByText('Ali Traoré demande ta position'));
    expect(get).toHaveBeenCalledWith('/localisation/demandes/recues');
    expect(screen.getByText('Expire à 14:45')).toBeTruthy();
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/localisation/d1');
  });

  it('aucune demande : rien', async () => {
    get.mockResolvedValue({ data: [] });
    monter();
    await waitFor(() => expect(get).toHaveBeenCalled());
    expect(screen.queryByText(/demande ta position/)).toBeNull();
  });
});
