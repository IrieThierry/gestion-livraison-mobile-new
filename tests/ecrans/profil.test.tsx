import { fireEvent, render, screen } from '@testing-library/react-native';
import { naviguer } from '../../lib/navigation-app';
import Profil from '../../app/(livreur)/profil/index';

jest.mock('expo-router', () => ({
  usePathname: () => '/profil',
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
let mockUser: Record<string, unknown> = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', username: 'awa', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser, logout: jest.fn() }),
}));
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ theme: 'system', setTheme: jest.fn() }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', username: 'awa', parentId: null };
});

describe('Onglet Moi', () => {
  it('Dépenses, Reversements et Clôtures sont présents ; plus de « Portail web »', () => {
    render(<Profil />);
    expect(screen.queryByText('Portail web')).toBeNull();
    expect(screen.queryByText('Plus de fonctions')).toBeNull();

    fireEvent.press(screen.getByText('Dépenses'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/cash/depenses');
    fireEvent.press(screen.getByText('Mes reversements'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/cash/reversements');
    fireEvent.press(screen.getByText('Clôtures journalières'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/clotures');
  });

  it('apprenti : mêmes entrées Dépenses / Reversements / Clôtures', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    render(<Profil />);
    expect(screen.getByText('Dépenses')).toBeTruthy();
    expect(screen.getByText('Mes reversements')).toBeTruthy();
    expect(screen.getByText('Clôtures journalières')).toBeTruthy();
    expect(screen.queryByText('Mes apprentis')).toBeNull();
  });

  it('remises d’argent : « Mes remises » pour l’apprenti seulement', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    render(<Profil />);
    expect(screen.queryByText('Remises des apprentis')).toBeNull();
    fireEvent.press(screen.getByText('Mes remises'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/profil/remises');
  });

  it('remises d’argent : « Remises des apprentis » pour le principal seulement', () => {
    render(<Profil />);
    expect(screen.queryByText('Mes remises')).toBeNull();
    fireEvent.press(screen.getByText('Remises des apprentis'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/profil/remises-apprentis');
  });
});

describe('Onglet Moi : organisation B2B', () => {
  it('commercial : rôle affiché, « Mes factures », ni fournisseurs ni « Mes apprentis », remises à « ton responsable »', () => {
    mockUser = { ...mockUser, parentId: 'r1', organisationId: 'o1', organisationRole: 'COMMERCIAL', profile: 'LIVREUR' };
    render(<Profil />);
    expect(screen.getByText(/awa · Commercial/)).toBeTruthy();
    expect(screen.queryByText('Mes fournisseurs')).toBeNull();
    expect(screen.queryByText('Mes apprentis')).toBeNull();
    expect(screen.getByText('Argent remis à ton responsable')).toBeTruthy();
    fireEvent.press(screen.getByText('Mes factures'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/profil/factures');
  });

  it('responsable (O15, espace en lecture) : « Remises des commerciaux », ni « Mes commerciaux », ni fournisseurs, ni factures', () => {
    mockUser = { ...mockUser, parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    render(<Profil />);
    expect(screen.queryByText('Mes commerciaux')).toBeNull();
    expect(screen.getByText('Remises des commerciaux')).toBeTruthy();
    expect(screen.queryByText('Mes fournisseurs')).toBeNull();
    expect(screen.queryByText('Mes factures')).toBeNull();
  });

  it('livreur indépendant : « Mes fournisseurs » toujours présent, pas de « Mes factures »', () => {
    render(<Profil />);
    expect(screen.getByText('Mes fournisseurs')).toBeTruthy();
    expect(screen.getByText('Mes apprentis')).toBeTruthy();
    expect(screen.queryByText('Mes factures')).toBeNull();
  });
});
