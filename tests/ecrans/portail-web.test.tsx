import { fireEvent, render, screen } from '@testing-library/react-native';
import PortailWeb from '../../app/portail-web';

const mockLogout = jest.fn(async () => {});
let mockUser: Record<string, unknown> = { prenom: 'Ali', profile: 'ADMIN' };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser, logout: mockLogout }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { prenom: 'Ali', profile: 'ADMIN' };
});

describe('Écran « Utilisez le portail web » (ADMIN seulement, F1)', () => {
  it('ADMIN : texte court et bouton Se déconnecter', () => {
    render(<PortailWeb />);
    expect(screen.getByText('Utilisez le portail web')).toBeTruthy();
    expect(screen.getByText(/réservée aux livreurs et aux fournisseurs/)).toBeTruthy();
    fireEvent.press(screen.getByText('Se déconnecter'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('pas d’onglets livreur sur cet écran', () => {
    render(<PortailWeb />);
    expect(screen.queryByText('Tournée')).toBeNull();
    expect(screen.queryByText('Clients')).toBeNull();
  });
});
