import { fireEvent, render, screen } from '@testing-library/react-native';
import NouvelleCommande from '../../app/(livreur)/cash/commandes/nouvelle';
import { useCatalogueFournisseur } from '../../features/commandes/hooks';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
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
  const user = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null };
  return { useAuthStore: (sel: (s: unknown) => unknown) => sel({ user }) };
});
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('../../features/lookups/hooks', () => ({
  useFournisseursPartenaires: () => ({
    data: [{ id: 'f-1', libelle: 'Fournisseur Un' }],
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock('../../features/commandes/hooks', () => ({
  useCatalogueFournisseur: jest.fn(),
  useCreerCommande: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('../../components/livreur/ApprentiAffecteField', () => ({
  ApprentiAffecteField: () => null,
}));
jest.mock('../../components/shared/SelectField', () => {
  const { Pressable, Text } = require('react-native');
  return {
    SelectField: ({ onChange }: { onChange: (id: string) => void }) => (
      <Pressable onPress={() => onChange('f-1')}>
        <Text>choisir-fournisseur</Text>
      </Pressable>
    ),
  };
});

const ligne = (id: string, designation: string, photoUrl: string | null) => ({
  id: `pf-${id}`,
  prixDeVente: 500,
  actif: true,
  produit: { id, code: id, designation, photoUrl },
});

describe('Nouvelle commande (livreur) : vignettes produit', () => {
  it('affiche la photo du produit, ou son initiale à défaut', () => {
    (useCatalogueFournisseur as jest.Mock).mockReturnValue({
      data: [ligne('p1', 'Biscuit', '/uploads/produit/p1.jpg'), ligne('p2', 'Lait', null)],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<NouvelleCommande />);
    fireEvent.press(screen.getByText('choisir-fournisseur'));

    expect(screen.getByLabelText('Photo de Biscuit')).toBeTruthy();
    expect(screen.queryByLabelText('Photo de Lait')).toBeNull();
    expect(screen.getByText('L')).toBeTruthy();
    expect(screen.getByText('Biscuit')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
  });
});
