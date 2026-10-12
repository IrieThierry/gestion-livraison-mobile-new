import { fireEvent, render, screen } from '@testing-library/react-native';
import PortailWeb from '../../app/portail-web';

const mockLogout = jest.fn(async () => {});
let mockUser: Record<string, unknown> = { prenom: 'Ali', profile: 'FOURNISSEUR' };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser, logout: mockLogout }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { prenom: 'Ali', profile: 'FOURNISSEUR' };
});

describe('Écran « Utilisez le portail web »', () => {
  it.each(['FOURNISSEUR', 'ADMIN'])('%s : texte court et bouton Se déconnecter', (profile) => {
    mockUser = { prenom: 'Ali', profile };
    render(<PortailWeb />);
    expect(screen.getByText('Utilisez le portail web')).toBeTruthy();
    expect(screen.getByText(/réservée aux livreurs/)).toBeTruthy();
    fireEvent.press(screen.getByText('Se déconnecter'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('pas d’onglets livreur sur cet écran', () => {
    render(<PortailWeb />);
    expect(screen.queryByText('Tournée')).toBeNull();
    expect(screen.queryByText('Clients')).toBeNull();
  });
});
