import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ModifierInfos from '../../app/(livreur)/profil/infos';

jest.mock('expo-router', () => ({
  usePathname: () => '/profil/infos',
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
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
jest.mock('../../stores/authStore', () => {
  const user = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', username: 'awa', contact: '0712345678', email: '', parentId: null };
  const useAuthStore = (sel: (s: unknown) => unknown) => sel({ user });
  useAuthStore.setState = jest.fn();
  return { useAuthStore };
});
jest.mock('../../features/auth/api', () => ({ authApi: { updateProfile: jest.fn() } }));
jest.mock('../../lib/image-picker', () => ({ pickImage: jest.fn() }));
jest.mock('../../features/photos/hooks', () => ({
  useUploadMaPhoto: () => ({ mutate: jest.fn(), isPending: false }),
  useSupprimerMaPhoto: () => ({ mutate: jest.fn(), isPending: false }),
}));
let mockAbonnement: { data: unknown; isLoading: boolean; isError: boolean } = { data: null, isLoading: false, isError: false };
jest.mock('../../features/abonnement/hooks', () => ({
  useMonAbonnement: () => ({ ...mockAbonnement, refetch: jest.fn() }),
}));

function afficher() {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <ModifierInfos />
    </QueryClientProvider>,
  );
}

const abo = (statut: string, herite = false) => ({
  data: { statut, formule: 'LIVREUR', debut: '2026-10-12', finEssai: null, finPeriode: null, herite },
  isLoading: false,
  isError: false,
});

describe('Moi → Mes infos : ligne Abonnement', () => {
  it.each([
    ['ESSAI', 'Essai gratuit'],
    ['ACTIF', 'Actif'],
    ['EXPIRE', 'Expiré — consultation seule'],
  ])('%s → « %s »', (statut, libelle) => {
    mockAbonnement = abo(statut);
    afficher();
    expect(screen.getByText('Abonnement')).toBeTruthy();
    expect(screen.getByText(libelle)).toBeTruthy();
  });

  it('apprenti : abonnement de son livreur principal', () => {
    mockAbonnement = abo('ACTIF', true);
    afficher();
    expect(screen.getByText('Actif')).toBeTruthy();
    expect(screen.getByText(/livreur principal/)).toBeTruthy();
  });

  it('sans abonnement (204) : pas de ligne', () => {
    mockAbonnement = { data: null, isLoading: false, isError: false };
    afficher();
    expect(screen.queryByText('Abonnement')).toBeNull();
  });
});
