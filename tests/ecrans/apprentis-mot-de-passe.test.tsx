import { act, fireEvent, render, screen } from '@testing-library/react-native';
import ApprentisList from '../../app/(livreur)/profil/apprentis/index';
import { dialog } from '../../lib/dialog';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => ({}),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useNavigation: () => ({ getState: () => undefined }),
}));
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
  origineDe: jest.fn(() => null),
}));
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
let mockUser: Record<string, unknown> = { id: 'r1', prenom: 'Jean', nom: 'Racine', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
const mockReset = jest.fn();
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({
    data: [
      { id: 'a1', prenom: 'Moussa', nom: 'Diallo', username: 'moussa', actif: true },
      { id: 'a2', prenom: 'Ibrahim', nom: 'Sow', username: 'ibra', actif: true },
    ],
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
  useToggleApprentiActif: () => ({ mutate: jest.fn(), isPending: false }),
  useResetMotDePasse: () => ({ mutate: mockReset, isPending: false }),
  useDemandesReinitialisation: () => ({
    data: [{ id: 'd1', compteId: 'a2', statut: 'EN_ATTENTE' }],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));

beforeEach(() => jest.clearAllMocks());

describe('Mes apprentis : demandes « Mot de passe oublié » (M1)', () => {
  it('badge « Mot de passe demandé » sur l’apprenti qui a une demande en attente seulement', () => {
    render(<ApprentisList />);
    expect(screen.getAllByText('Mot de passe demandé')).toHaveLength(1);
  });

  it('réinitialiser : confirmation, envoi unique, mot de passe provisoire affiché', () => {
    render(<ApprentisList />);
    fireEvent.press(screen.getByLabelText('Réinitialiser le mot de passe de Ibrahim Sow'));
    const confirmation = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(confirmation.title).toBe('Réinitialiser le mot de passe ?');
    act(() => {
      confirmation.onConfirm();
      confirmation.onConfirm();
    });
    expect(mockReset).toHaveBeenCalledTimes(1);
    const [id, opts] = mockReset.mock.calls[0];
    expect(id).toBe('a2');
    act(() => {
      opts.onSuccess({ tempPassword: 'Xy7kP2qa' });
      opts.onSettled();
    });
    expect(dialog.info).toHaveBeenCalledWith(
      'Mot de passe provisoire',
      expect.stringContaining('Xy7kP2qa'),
      expect.objectContaining({ autoDismissMs: 0 }),
    );
  });

  it('responsable (lecture seule) : badge visible, pas de bouton de réinitialisation', () => {
    mockUser = { id: 'r1', prenom: 'Jean', nom: 'Racine', parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    render(<ApprentisList />);
    expect(screen.getAllByText('Mot de passe demandé')).toHaveLength(1);
    expect(screen.queryByLabelText(/Réinitialiser le mot de passe/)).toBeNull();
    mockUser = { id: 'r1', prenom: 'Jean', nom: 'Racine', parentId: null };
  });
});
