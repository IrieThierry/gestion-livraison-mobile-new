import { render, screen } from '@testing-library/react-native';
import ProduitsVendusAujourdhui from '../../app/(livreur)/livraisons/produits-vendus';
import { useMouvementsStock } from '../../features/stock/hooks';
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
}));
jest.mock('../../stores/authStore', () => {
  const user = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null };
  return { useAuthStore: (sel: (s: unknown) => unknown) => sel({ user }) };
});
jest.mock('../../features/stock/hooks', () => ({ useMouvementsStock: jest.fn() }));

const mouvements = useMouvementsStock as jest.Mock;
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});
const jour = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
})();
const mv = (type: TypeMouvementStock, designation: string, quantite: number): MouvementStockResponse => ({
  date: `${jour}T10:00:00`,
  type,
  produit: { id: `id-${designation}`, code: designation, designation },
  quantite,
  reference: null,
  contrepartie: null,
});

beforeEach(() => jest.clearAllMocks());

describe('Produits vendus aujourd’hui', () => {
  it('lit les mouvements du jour du livreur connecté', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<ProduitsVendusAujourdhui />);
    expect(mouvements).toHaveBeenCalledWith('liv-1', { debut: jour, fin: jour });
  });

  it('détail par produit, quantité décroissante, livré seulement', () => {
    mouvements.mockReturnValue(
      lecture([
        mv('LIVRAISON', 'Pain', -5),
        mv('LIVRAISON', 'Lait', -12),
        mv('LIVRAISON', 'Pain', -3),
        mv('RETOUR_EN_STOCK', 'Pain', 4),
        mv('RECEPTION', 'Sucre', 50),
      ]),
    );
    render(<ProduitsVendusAujourdhui />);
    expect(screen.getByText("Produits vendus aujourd'hui")).toBeTruthy();
    expect(screen.getByText('20 unités · 2 produits')).toBeTruthy();
    const designations = screen.getAllByText(/^(Lait|Pain|Sucre)$/).map((n) => n.props.children);
    expect(designations).toEqual(['Lait', 'Pain']);
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('état vide', () => {
    mouvements.mockReturnValue(lecture([mv('RECEPTION', 'Sucre', 50)]));
    render(<ProduitsVendusAujourdhui />);
    expect(screen.getByText("Aucune vente aujourd'hui")).toBeTruthy();
  });

  it('erreur : message de l’erreur', () => {
    mouvements.mockReturnValue(lecture(undefined, { isError: true, error: { response: { status: 500, data: { message: 'Serveur indisponible' } } } }));
    render(<ProduitsVendusAujourdhui />);
    expect(screen.getByText('Chargement impossible')).toBeTruthy();
    expect(screen.getByText('Serveur indisponible')).toBeTruthy();
  });
});
