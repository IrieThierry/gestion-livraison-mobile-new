import { fireEvent, render, screen } from '@testing-library/react-native';
import { ouvrir } from '../../lib/navigation-app';
import Tournee from '../../app/(livreur)/index';
import { useMouvementsStock } from '../../features/stock/hooks';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import type { MouvementStockResponse, TypeMouvementStock } from '../../types/api';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
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
let mockNbCommandes = 0;
jest.mock('../../features/commandes/hooks', () => ({
  useCommandesAReceptionner: () => ({ data: Array.from({ length: mockNbCommandes }), refetch: jest.fn() }),
}));
let mockRemises: unknown[] = [];
jest.mock('../../features/remises-argent/hooks', () => ({
  useRemisesAConfirmer: () => ({ data: mockRemises, isLoading: false, isError: false, refetch: jest.fn() }),
}));
let mockEchues: unknown[] = [];
jest.mock('../../features/previsions/hooks', () => ({
  usePrevisionsEchues: () => ({ echues: mockEchues, isLoading: false, isError: false, refetch: jest.fn() }),
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
  mouvements.mockReturnValue(lecture([]));
  mockNbCommandes = 0;
  mockEchues = [];
  mockRemises = [];
});

describe('Accueil : cloche', () => {
  it('compte commandes à réceptionner + prévisions échues et ouvre la feuille Notifications', () => {
    mockNbCommandes = 2;
    mockEchues = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
    render(<Tournee />);
    expect(screen.getByText('5')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Notifications : 5'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/previsions/echues');
  });

  it('principal : + remises déclarées à confirmer', () => {
    mockNbCommandes = 1;
    mockRemises = [{ statut: 'DECLAREE' }, { statut: 'DECLAREE' }];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 3')).toBeTruthy();
  });

  it('apprenti : les remises ne comptent pas', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mockRemises = [{ statut: 'DECLAREE' }];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0')).toBeTruthy();
  });

  it('sans rien à traiter : pas de badge', () => {
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0')).toBeTruthy();
  });
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
    // Nombre de produits différents : Pain et Lait vendus → 2 ; seul Pain réceptionné (transfert exclu) → 1.
    expect(screen.getByLabelText('Produits vendus : 2')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : 1')).toBeTruthy();
    // Les anciens blocs « Produits vendus · aujourd'hui » et « Réceptions » ont disparu.
    expect(screen.queryByText(/Produits vendus · aujourd/)).toBeNull();
    expect(screen.queryByText(/Réceptions · aujourd/)).toBeNull();
    expect(screen.queryByText('Pain')).toBeNull();
  });

  it('chaque chiffre ouvre sa page', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Livraisons : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons');
    fireEvent.press(screen.getByLabelText('Produits vendus : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons/produits-vendus');
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/commandes');
  });

  it('tuile « À encaisser » → Encours ; actions rapides sur une pile propre', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('À encaisser'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/encours');
    fireEvent.press(screen.getByText('Encaisser'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons');
    fireEvent.press(screen.getByText('Retour produit'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/retour-client');
  });

  it('apprenti : Réceptionnés ouvre les commandes à réceptionner', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/commandes/a-receptionner');
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
