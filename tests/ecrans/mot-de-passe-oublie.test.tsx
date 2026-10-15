import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import MotDePasseOublie from '../../app/(auth)/mot-de-passe-oublie';
import MotDePasseProvisoire from '../../app/mot-de-passe-provisoire';
import { authApi } from '../../features/auth/api';
import { MESSAGE_DEMANDE_MOT_DE_PASSE, MESSAGES_COMPTE } from '../../features/auth/schemas';
import { useDialogStore } from '../../stores/dialogStore';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) },
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../../features/auth/api', () => ({
  authApi: { motDePasseOublie: jest.fn(), changePassword: jest.fn() },
}));
const mockAuth = {
  user: { id: 'u-1', username: 'awa', profile: 'LIVREUR', motDePasseProvisoire: true } as Record<string, unknown>,
  majUtilisateur: jest.fn(async () => undefined),
  logout: jest.fn(async () => undefined),
};
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel(mockAuth),
}));

const demander = authApi.motDePasseOublie as jest.Mock;
const changer = authApi.changePassword as jest.Mock;

function afficher(el: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(<QueryClientProvider client={qc}>{el}</QueryClientProvider>);
}

async function laisserFinir() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 10));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
});
afterEach(laisserFinir);

describe('Mot de passe oublié (M1)', () => {
  it('numéro hors règle : refusé avant l’envoi', () => {
    afficher(<MotDePasseOublie />);
    fireEvent.changeText(screen.getByLabelText("Nom d'utilisateur"), 'awa');
    fireEvent.changeText(screen.getByLabelText('Numéro de téléphone'), '0812345678');
    fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(demander).not.toHaveBeenCalled();
    expect(useDialogStore.getState().message).toBe(MESSAGES_COMPTE.contact);
  });

  it('demande envoyée une fois (identifiant sans espaces), message unique, retour à la connexion', async () => {
    demander.mockResolvedValue({ message: MESSAGE_DEMANDE_MOT_DE_PASSE });
    afficher(<MotDePasseOublie />);
    fireEvent.changeText(screen.getByLabelText("Nom d'utilisateur"), '  awa ');
    fireEvent.changeText(screen.getByLabelText('Numéro de téléphone'), '0712345678');
    fireEvent.press(screen.getByText('Envoyer la demande'));
    fireEvent.press(screen.getByLabelText('Envoyer la demande'));
    await waitFor(() => expect(useDialogStore.getState().title).toBe('Demande envoyée'));
    expect(demander).toHaveBeenCalledTimes(1);
    expect(demander.mock.calls[0][0]).toEqual({ username: 'awa', contact: '0712345678' });
    expect(useDialogStore.getState().message).toBe(MESSAGE_DEMANDE_MOT_DE_PASSE);
    act(() => {
      useDialogStore.getState().actions![0].onPress!();
    });
    expect(router.back).toHaveBeenCalled();
  });
});

describe('Choisis ton nouveau mot de passe (M1)', () => {
  const saisir = (actuel: string, nouveau: string, confirmation: string) => {
    fireEvent.changeText(screen.getByLabelText('Mot de passe provisoire'), actuel);
    fireEvent.changeText(screen.getByLabelText('Nouveau mot de passe'), nouveau);
    fireEvent.changeText(screen.getByLabelText('Confirmer le nouveau mot de passe'), confirmation);
    fireEvent.press(screen.getByText('Enregistrer le mot de passe'));
  };

  it('règles existantes : confirmation différente refusée', () => {
    afficher(<MotDePasseProvisoire />);
    saisir('Prov123', 'nouveau1', 'nouveau2');
    expect(changer).not.toHaveBeenCalled();
    expect(useDialogStore.getState().message).toBe('Les mots de passe ne correspondent pas');
  });

  it('changement : provisoire levé puis accueil', async () => {
    changer.mockResolvedValue({ message: 'ok' });
    afficher(<MotDePasseProvisoire />);
    saisir('Prov123', 'nouveau1', 'nouveau1');
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/(livreur)'));
    expect(changer.mock.calls[0][0]).toEqual({ currentPassword: 'Prov123', newPassword: 'nouveau1' });
    expect(mockAuth.majUtilisateur).toHaveBeenCalledWith(expect.objectContaining({ motDePasseProvisoire: false }));
  });

  it('seule sortie : se déconnecter', async () => {
    afficher(<MotDePasseProvisoire />);
    fireEvent.press(screen.getByText('Se déconnecter'));
    const confirmer = useDialogStore.getState().actions!.find((a) => a.label === 'Se déconnecter')!;
    await act(async () => {
      await confirmer.onPress!();
    });
    expect(mockAuth.logout).toHaveBeenCalled();
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
