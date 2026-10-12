import { fireEvent, render, screen } from '@testing-library/react-native';
import { ouvrir } from '../../lib/navigation-app';
import { FabSheet } from '../../components/livreur/FabSheet';
import { entreesAccederA } from '../../lib/acceder-a';

jest.mock('expo-router', () => ({ usePathname: () => '/',
  router: { push: jest.fn() } }));
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
}));
let mockUser: { id: string; parentId: string | null } | null = { id: 'p', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'p', parentId: null };
});

describe('entreesAccederA', () => {
  it('livreur principal : les 10 listes dans l’ordre', () => {
    expect(entreesAccederA({ parentId: null }).map((e) => [e.label, e.chemin])).toEqual([
      ['Mes livraisons', '/(livreur)/livraisons'],
      ['Mes clients', '/(livreur)/clients'],
      ['Mes encaissements', '/(livreur)/cash/encaissements'],
      ['Mes versements', '/(livreur)/cash/versements'],
      ['Commandes', '/(livreur)/cash/commandes'],
      ['Retours produits', '/(livreur)/cash/retours'],
      ['Reversements', '/(livreur)/cash/reversements'],
      ['Dépenses', '/(livreur)/cash/depenses'],
      ['Prévisions', '/(livreur)/previsions'],
      ['Clôtures', '/(livreur)/clotures'],
    ]);
  });

  it('apprenti : pas de versements, commandes à réceptionner, reversements gardés', () => {
    const entrees = entreesAccederA({ parentId: 'p' });
    expect(entrees.map((e) => e.label)).toEqual([
      'Mes livraisons',
      'Mes clients',
      'Mes encaissements',
      'Commandes',
      'Retours produits',
      'Reversements',
      'Dépenses',
      'Prévisions',
      'Clôtures',
    ]);
    expect(entrees.find((e) => e.cle === 'commandes')?.chemin).toBe('/(livreur)/cash/commandes/a-receptionner');
  });
});

describe('FabSheet « Accéder à »', () => {
  it('titre, 10 entrées, un appui ferme la feuille et ouvre la liste sur une pile propre', () => {
    const onClose = jest.fn();
    render(<FabSheet open onClose={onClose} />);
    expect(screen.getByText('Accéder à')).toBeTruthy();
    expect(screen.queryByText('Créer')).toBeNull();
    expect(screen.getAllByRole('button').filter((b) => b.props.accessibilityLabel !== 'Fermer')).toHaveLength(10);

    fireEvent.press(screen.getByLabelText('Mes versements'));
    expect(onClose).toHaveBeenCalled();
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/versements');
  });

  it('apprenti : 9 entrées, Commandes → à réceptionner', () => {
    mockUser = { id: 'a', parentId: 'p' };
    render(<FabSheet open onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Mes versements')).toBeNull();
    fireEvent.press(screen.getByLabelText('Commandes'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });
});
