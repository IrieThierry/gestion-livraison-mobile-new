import { fireEvent, render, screen } from '@testing-library/react-native';
import { naviguer } from '../../lib/navigation-app';
import LivraisonsList from '../../app/(livreur)/livraisons/index';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
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
jest.mock('../../features/livraisons/hooks', () => ({
  useLivraisonsByLivreur: () => ({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() }),
}));

describe('Mes livraisons', () => {
  it('bouton « Nouvelle livraison » vers le formulaire', () => {
    render(<LivraisonsList />);
    fireEvent.press(screen.getByLabelText('Nouvelle livraison'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/livraisons/nouvelle');
  });
});
