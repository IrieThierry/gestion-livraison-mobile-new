import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { naviguer } from '../../lib/navigation-app';
import Profil from '../../app/(livreur)/profil/index';
import { Biometric } from '../../lib/biometric';
import { enregistrerChoixBiometrie, lireChoixBiometrie } from '../../lib/biometrie-choix';

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
jest.mock('../../lib/biometric', () => ({ Biometric: { isAvailable: jest.fn(async () => false) } }));
jest.mock('../../lib/biometrie-choix', () => ({
  lireChoixBiometrie: jest.fn(async () => null),
  enregistrerChoixBiometrie: jest.fn(async () => undefined),
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

  it('responsable : « Mes commerciaux » et « Remises des commerciaux », pas de fournisseurs ni de factures ici', () => {
    mockUser = { ...mockUser, parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    render(<Profil />);
    expect(screen.getByText('Mes commerciaux')).toBeTruthy();
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

describe('Profil : déverrouillage biométrique (S4)', () => {
  const LIBELLE = 'Déverrouiller avec Face ID / empreinte';

  it('appareil non compatible : pas d’interrupteur', async () => {
    render(<Profil />);
    await act(async () => {});
    expect(screen.queryByText(LIBELLE)).toBeNull();
  });

  it('appareil compatible : l’interrupteur reflète le choix du compte et l’enregistre', async () => {
    (Biometric.isAvailable as jest.Mock).mockResolvedValueOnce(true);
    (lireChoixBiometrie as jest.Mock).mockResolvedValueOnce('refusee');
    render(<Profil />);
    expect(await screen.findByText(LIBELLE)).toBeTruthy();
    expect(lireChoixBiometrie).toHaveBeenCalledWith('awa');
    const interrupteur = screen.getByLabelText(LIBELLE);
    expect(interrupteur.props.value).toBe(false);
    await act(async () => {
      fireEvent(interrupteur, 'valueChange', true);
    });
    expect(enregistrerChoixBiometrie).toHaveBeenLastCalledWith('awa', 'active');
    await waitFor(() => expect(screen.getByLabelText(LIBELLE).props.value).toBe(true));
    await act(async () => {
      fireEvent(screen.getByLabelText(LIBELLE), 'valueChange', false);
    });
    expect(enregistrerChoixBiometrie).toHaveBeenLastCalledWith('awa', 'refusee');
  });
});
