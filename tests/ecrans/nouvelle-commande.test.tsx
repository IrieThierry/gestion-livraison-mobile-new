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

describe('Nouvelle commande : préremplie depuis le cumul des prévisions', () => {
  it('quantités = cumul brut des produits proposés ; les autres listés à part ; source consommée', () => {
    const { useCommandePrefillStore } = require('../../stores/commandePrefillStore');
    (useCatalogueFournisseur as jest.Mock).mockReturnValue({
      data: [ligne('p1', 'Biscuit', null), ligne('p2', 'Lait', null)],
      isLoading: false,
      isError: false,
      error: null,
    });
    useCommandePrefillStore.getState().definir({
      fournisseurId: 'f-1',
      jour: '2026-10-13',
      cumul: [
        { produit: { id: 'p1', code: 'p1', designation: 'Biscuit' }, qteCumulee: 12 },
        { produit: { id: 'p9', code: 'p9', designation: 'Yaourt' }, qteCumulee: 4 },
      ],
    });
    render(<NouvelleCommande />);

    expect(screen.getByLabelText('Quantité de Biscuit').props.value).toBe('12');
    expect(screen.getByLabelText('Quantité de Lait').props.value).toBe('');
    expect(screen.getByText('Non proposés par ce fournisseur')).toBeTruthy();
    expect(screen.getByText('Yaourt')).toBeTruthy();
    expect(screen.getByText('Prérempli depuis le cumul des prévisions du 13/10/2026')).toBeTruthy();
    expect(useCommandePrefillStore.getState().source).toBeNull();
  });
});

describe('Nouvelle commande : deux « Commander » sans démontage', () => {
  it('le second Commander remplace fournisseur et quantités ; la source est vidée', () => {
    const { act } = require('@testing-library/react-native');
    const { useCommandePrefillStore } = require('../../stores/commandePrefillStore');
    (useCatalogueFournisseur as jest.Mock).mockReturnValue({
      data: [ligne('p1', 'Biscuit', null), ligne('p2', 'Lait', null)],
      isLoading: false,
      isError: false,
      error: null,
    });
    useCommandePrefillStore.getState().definir({
      fournisseurId: 'f-1',
      jour: '2026-10-13',
      cumul: [{ produit: { id: 'p1', code: 'p1', designation: 'Biscuit' }, qteCumulee: 12 }],
    });
    render(<NouvelleCommande />);
    expect(screen.getByLabelText('Quantité de Biscuit').props.value).toBe('12');

    act(() => {
      useCommandePrefillStore.getState().definir({
        fournisseurId: 'f-1',
        jour: '2026-10-14',
        cumul: [{ produit: { id: 'p2', code: 'p2', designation: 'Lait' }, qteCumulee: 7 }],
      });
    });
    expect(screen.getByLabelText('Quantité de Biscuit').props.value).toBe('');
    expect(screen.getByLabelText('Quantité de Lait').props.value).toBe('7');
    expect(screen.getByText('Prérempli depuis le cumul des prévisions du 14/10/2026')).toBeTruthy();
    expect(useCommandePrefillStore.getState().source).toBeNull();
  });
});

describe('Nouvelle commande : total estimé (N2a)', () => {
  it('somme quantités × prix affiché, mise à jour à chaque saisie', () => {
    (useCatalogueFournisseur as jest.Mock).mockReturnValue({
      data: [
        ligne('p1', 'Biscuit', null),
        { ...ligne('p2', 'Lait', null), prixDeVente: 300, prixParticulier: true },
      ],
      isLoading: false,
      isError: false,
      error: null,
    });
    render(<NouvelleCommande />);
    fireEvent.press(screen.getByText('choisir-fournisseur'));
    const total = () => screen.getByTestId('total-estime').props.children.join('');
    expect(screen.getByText('Total estimé')).toBeTruthy();
    expect(total()).toBe('0 F');
    fireEvent.changeText(screen.getByLabelText('Quantité de Biscuit'), '3');
    expect(total()).toMatch(/^1\s500 F$/);
    fireEvent.changeText(screen.getByLabelText('Quantité de Lait'), '2');
    expect(total()).toMatch(/^2\s100 F$/);
    // Saisie invalide : ignorée dans le total.
    fireEvent.changeText(screen.getByLabelText('Quantité de Lait'), 'x');
    expect(total()).toMatch(/^1\s500 F$/);
  });
});
