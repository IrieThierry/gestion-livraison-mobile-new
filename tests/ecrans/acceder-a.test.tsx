import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { FabSheet } from '../../components/livreur/FabSheet';
import { entreesAccederA } from '../../lib/acceder-a';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
let mockUser: { id: string; parentId: string | null } | null = { id: 'p', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'p', parentId: null };
});

describe('entreesAccederA', () => {
  it('livreur principal : les 8 listes dans l’ordre', () => {
    expect(entreesAccederA({ parentId: null }).map((e) => [e.label, e.chemin])).toEqual([
      ['Mes livraisons', '/(livreur)/livraisons'],
      ['Mes clients', '/(livreur)/clients'],
      ['Mes versements', '/(livreur)/cash/versements'],
      ['Commandes', '/(livreur)/cash/commandes'],
      ['Retours produits', '/(livreur)/cash/retours'],
      ['Dépenses', '/(livreur)/cash/depenses'],
      ['Prévisions', '/(livreur)/previsions'],
      ['Clôtures', '/(livreur)/clotures'],
    ]);
  });

  it('apprenti : pas de versements, commandes à réceptionner', () => {
    const entrees = entreesAccederA({ parentId: 'p' });
    expect(entrees.map((e) => e.label)).toEqual([
      'Mes livraisons',
      'Mes clients',
      'Commandes',
      'Retours produits',
      'Dépenses',
      'Prévisions',
      'Clôtures',
    ]);
    expect(entrees.find((e) => e.cle === 'commandes')?.chemin).toBe('/(livreur)/cash/commandes/a-receptionner');
  });
});

describe('FabSheet « Accéder à »', () => {
  it('titre, 8 entrées, un appui ferme la feuille et pousse la liste', () => {
    const onClose = jest.fn();
    render(<FabSheet open onClose={onClose} />);
    expect(screen.getByText('Accéder à')).toBeTruthy();
    expect(screen.queryByText('Créer')).toBeNull();
    expect(screen.getAllByRole('button').filter((b) => b.props.accessibilityLabel !== 'Fermer')).toHaveLength(8);

    fireEvent.press(screen.getByLabelText('Mes versements'));
    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/(livreur)/cash/versements');
  });

  it('apprenti : 7 entrées, Commandes → à réceptionner', () => {
    mockUser = { id: 'a', parentId: 'p' };
    render(<FabSheet open onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Mes versements')).toBeNull();
    fireEvent.press(screen.getByLabelText('Commandes'));
    expect(router.push).toHaveBeenCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });
});
