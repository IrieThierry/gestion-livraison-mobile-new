import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Tournee from '../../app/(livreur)/index';
import { useMouvementsStock } from '../../features/stock/hooks';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import type { MouvementStockResponse, TypeMouvementStock } from '../../types/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
}));
let mockUser: Record<string, unknown> = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null, statut: 'ACTIF' };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsByLivreur: jest.fn() }));
jest.mock('../../features/encaissements/hooks', () => ({
  useEncaissementsByLivreur: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/clients/hooks', () => ({
  useEncoursByLivreur: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: () => ({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() }),
  useMouvementsStock: jest.fn(),
}));
jest.mock('../../features/commandes/hooks', () => ({
  useCommandesAReceptionner: () => ({ data: [], refetch: jest.fn() }),
}));

const mouvements = useMouvementsStock as jest.Mock;
const livraisons = useLivraisonsByLivreur as jest.Mock;

const aujourdhui = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00:00`;
})();
const mv = (type: TypeMouvementStock, designation: string, quantite: number): MouvementStockResponse => ({
  date: aujourdhui,
  type,
  produit: { id: `id-${designation}`, code: designation, designation },
  quantite,
  reference: null,
  contrepartie: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null, statut: 'ACTIF' };
  livraisons.mockReturnValue(lecture([]));
});

describe('Accueil : chiffres cliquables de la carte verte', () => {
  it('affiche Livraisons, Produits vendus et Réceptionnés, sans les blocs détaillés', () => {
    mouvements.mockReturnValue(
      lecture([
        mv('LIVRAISON', 'Pain', -5),
        mv('LIVRAISON', 'Lait', -3),
        mv('RETOUR_EN_STOCK', 'Pain', 1),
        mv('RECEPTION', 'Pain', 20),
        mv('TRANSFERT_ENTREE', 'Lait', 6),
      ]),
    );
    render(<Tournee />);
    expect(screen.getByLabelText('Livraisons : 0')).toBeTruthy();
    expect(screen.getByLabelText('Produits vendus : 8')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : 20')).toBeTruthy();
    // Les anciens blocs « Produits vendus · aujourd'hui » et « Réceptions » ont disparu.
    expect(screen.queryByText(/Produits vendus · aujourd/)).toBeNull();
    expect(screen.queryByText(/Réceptions · aujourd/)).toBeNull();
    expect(screen.queryByText('Pain')).toBeNull();
  });

  it('chaque chiffre ouvre sa page', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Livraisons : 0'));
    expect(router.push).toHaveBeenLastCalledWith('/(livreur)/livraisons');
    fireEvent.press(screen.getByLabelText('Produits vendus : 0'));
    expect(router.push).toHaveBeenLastCalledWith('/(livreur)/livraisons/produits-vendus');
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(router.push).toHaveBeenLastCalledWith('/(livreur)/cash/commandes');
  });

  it('apprenti : Réceptionnés ouvre les commandes à réceptionner', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(router.push).toHaveBeenLastCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });

  it('chargement : « … » ; erreur : « — »', () => {
    mouvements.mockReturnValue(lecture(undefined, { isLoading: true }));
    livraisons.mockReturnValue(lecture(undefined, { isError: true }));
    const { unmount } = render(<Tournee />);
    expect(screen.getByLabelText('Produits vendus : …')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : …')).toBeTruthy();
    expect(screen.getByLabelText('Livraisons : —')).toBeTruthy();
    unmount();

    mouvements.mockReturnValue(lecture(undefined, { isError: true }));
    render(<Tournee />);
    expect(screen.getByLabelText('Produits vendus : —')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : —')).toBeTruthy();
  });
});
