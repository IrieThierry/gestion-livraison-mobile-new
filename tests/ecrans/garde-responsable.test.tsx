import { render } from '@testing-library/react-native';
import LivreurLayout from '../../app/(livreur)/_layout';

/**
 * Garde au rendu du layout des onglets (O15) : un écran de vente atteint par
 * le responsable (lien profond, état périmé) n'est jamais monté.
 */

const mockRedirect = jest.fn();
const mockHookVente = jest.fn();
let mockSegments: string[] = [];
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const EcranVente = () => {
    mockHookVente();
    return <Text>Écran de vente</Text>;
  };
  const Tabs = () => <EcranVente />;
  Tabs.Screen = () => null;
  return {
    Redirect: ({ href }: { href: string }) => {
      mockRedirect(href);
      return null;
    },
    Tabs,
    useSegments: () => mockSegments,
    useNavigationContainerRef: () => ({}),
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('../../lib/navigation-app', () => ({ brancherNavigation: jest.fn(), useRetourMateriel: jest.fn() }));
jest.mock('../../lib/onglets', () => ({ listenersRacineOnglet: () => ({}) }));
jest.mock('../../components/shared/OfflineBanner', () => ({ OfflineBanner: () => null }));
jest.mock('../../components/shared/PreparationRecuBanner', () => ({ PreparationRecuBanner: () => null }));
jest.mock('../../components/livreur/FabSheet', () => ({ FabSheet: () => null }));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ startWatching: jest.fn() }),
}));
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ effective: 'light' }),
}));
const RESPONSABLE = { id: 'r1', profile: 'LIVREUR', parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
let mockUser: Record<string, unknown> = RESPONSABLE;
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = RESPONSABLE;
});

describe('Garde au rendu des onglets (responsable)', () => {
  it('écran de vente atteint par le responsable : redirection, l’écran n’est pas monté', () => {
    for (const segments of [
      ['(livreur)', 'livraisons', 'nouvelle'],
      ['(livreur)', 'cash', 'encaisser'],
      ['(livreur)', 'clients'],
      ['(livreur)', 'profil', 'apprentis', 'nouveau'],
    ]) {
      mockSegments = segments;
      const r = render(<LivreurLayout />);
      expect(mockRedirect).toHaveBeenLastCalledWith('/(livreur)');
      expect(r.queryByText('Écran de vente')).toBeNull();
      r.unmount();
    }
    expect(mockHookVente).not.toHaveBeenCalled();
  });

  it('écrans de son espace : onglets rendus, pas de redirection', () => {
    for (const segments of [
      ['(livreur)'],
      ['(livreur)', 'notifications'],
      ['(livreur)', 'stock', 'transferts'],
      ['(livreur)', 'profil', 'apprentis', '[id]'],
    ]) {
      mockSegments = segments;
      const r = render(<LivreurLayout />);
      expect(r.getByText('Écran de vente')).toBeTruthy();
      r.unmount();
    }
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('commercial sur un écran de vente : inchangé', () => {
    mockUser = { ...RESPONSABLE, organisationRole: 'COMMERCIAL', parentId: 'r1' };
    mockSegments = ['(livreur)', 'livraisons', 'nouvelle'];
    render(<LivreurLayout />);
    expect(mockRedirect).not.toHaveBeenCalled();
    expect(mockHookVente).toHaveBeenCalled();
  });
});
