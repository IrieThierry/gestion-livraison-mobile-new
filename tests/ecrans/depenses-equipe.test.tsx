import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DepensesList from '../../app/(livreur)/cash/depenses/index';
import { apiClient } from '../../lib/api-client';
import { dialog } from '../../lib/dialog';
import type { DepenseResponse } from '../../types/api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), delete: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/cash/depenses',
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
}));
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
let mockUser: Record<string, unknown> = { id: 'P', prenom: 'Ali', nom: 'K', username: 'ali', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
let mockApprentis: unknown[] = [];
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({ data: mockApprentis, isLoading: false }),
}));

const get = apiClient.get as jest.Mock;

const dep = (over: Partial<DepenseResponse>): DepenseResponse => ({
  id: 'd',
  libelle: 'Dépense',
  categorie: 'CARBURANT',
  montant: 1000,
  dateDepense: '2026-10-14T00:00:00',
  commentaire: null,
  ...over,
});
const mienne = dep({ id: 'd1', libelle: 'Plein du matin', proprietaire: { id: 'P', nom: 'Ali K' }, proprietaireUtilisateurId: 'P' });
const apprentie = dep({
  id: 'd2',
  libelle: 'Vidange',
  categorie: 'ENTRETIEN',
  proprietaire: { id: 'a1', nom: 'Awa TRAORÉ' },
  proprietaireUtilisateurId: 'a1',
});

const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});
function rendre() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(qc);
  return render(
    <QueryClientProvider client={qc}>
      <DepensesList />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'P', prenom: 'Ali', nom: 'K', username: 'ali', parentId: null };
  mockApprentis = [
    { id: 'a1', prenom: 'Awa', nom: 'TRAORÉ', actif: true },
    { id: 'a2', prenom: 'Old', nom: 'X', actif: false },
  ];
  get.mockImplementation((_url: string, config?: { params?: Record<string, unknown> }) => {
    const p = config?.params ?? {};
    if (p.equipe) return Promise.resolve({ data: [mienne, apprentie] });
    if (p.livreurId === 'a1') return Promise.resolve({ data: [apprentie] });
    return Promise.resolve({ data: [mienne] });
  });
});

const choisir = (libelle: string) => {
  fireEvent.press(screen.getByText(screen.queryByText('Moi') ? 'Moi' : 'Équipe'));
  const items = screen.getAllByText(libelle);
  fireEvent.press(items[items.length - 1]);
};

describe('Dépenses de l’équipe (S5)', () => {
  it('principal : sélecteur Moi / Équipe / apprentis actifs ; « Moi » sans filtre', async () => {
    rendre();
    expect(await screen.findByText('Plein du matin')).toBeTruthy();
    expect(screen.getByText('Dépenses de')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/depense', { params: { startDate: undefined, endDate: undefined } });
    fireEvent.press(screen.getByText('Moi'));
    expect(screen.getAllByText('Équipe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Awa TRAORÉ').length).toBeGreaterThan(0);
    expect(screen.queryByText('Old X')).toBeNull();
  });

  it('Équipe : equipe=true, « par … » sur la dépense de l’apprenti, sans suppression', async () => {
    rendre();
    await screen.findByText('Plein du matin');
    choisir('Équipe');
    expect(await screen.findByText('Vidange')).toBeTruthy();
    expect(get).toHaveBeenCalledWith('/depense', expect.objectContaining({ params: expect.objectContaining({ equipe: true }) }));
    expect(screen.getByText('par Awa TRAORÉ')).toBeTruthy();
    expect(screen.queryByText('par Ali K')).toBeNull();
    expect(screen.getByLabelText('Supprimer Plein du matin')).toBeTruthy();
    expect(screen.queryByLabelText('Supprimer Vidange')).toBeNull();
    fireEvent.press(screen.getByLabelText('Supprimer Plein du matin'));
    expect(dialog.confirm).toHaveBeenCalled();
  });

  it('un apprenti : livreurId, lecture seule', async () => {
    rendre();
    await screen.findByText('Plein du matin');
    choisir('Awa TRAORÉ');
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/depense', expect.objectContaining({ params: expect.objectContaining({ livreurId: 'a1' }) })),
    );
    expect(await screen.findByText('Vidange')).toBeTruthy();
    expect(screen.queryByText('Plein du matin')).toBeNull();
    expect(screen.queryByLabelText('Supprimer Vidange')).toBeNull();
  });

  it('apprenti ou membre d’organisation : pas de sélecteur, ses dépenses seulement', async () => {
    mockUser = { ...mockUser, parentId: 'X' };
    const { unmount } = rendre();
    expect(await screen.findByText('Plein du matin')).toBeTruthy();
    expect(screen.queryByText('Dépenses de')).toBeNull();
    unmount();
    mockUser = { id: 'P', prenom: 'Rita', nom: 'R', parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    rendre();
    expect(await screen.findByText('Plein du matin')).toBeTruthy();
    expect(screen.queryByText('Dépenses de')).toBeNull();
    for (const call of get.mock.calls) {
      expect(call[1].params.equipe).toBeUndefined();
      expect(call[1].params.livreurId).toBeUndefined();
    }
  });
});
