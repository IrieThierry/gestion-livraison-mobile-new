import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Signup from '../../app/(auth)/signup';
import { authApi } from '../../features/auth/api';
import { useDialogStore } from '../../stores/dialogStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('../../features/auth/api', () => ({ authApi: { register: jest.fn() } }));

const register = authApi.register as jest.Mock;

function afficher() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false, gcTime: Infinity } } });
  render(
    <QueryClientProvider client={qc}>
      <Signup />
    </QueryClientProvider>,
  );
}

function remplir(patch: Partial<Record<string, string>> = {}) {
  const v = {
    prenom: 'Awa',
    nom: 'Kone',
    contact: '0712345678',
    username: 'awa',
    password: 'secret1',
    confirm: 'secret1',
    ...patch,
  };
  fireEvent.changeText(screen.getByPlaceholderText('Marc'), v.prenom);
  fireEvent.changeText(screen.getByPlaceholderText('Konan'), v.nom);
  fireEvent.changeText(screen.getByPlaceholderText('0712345678'), v.contact);
  fireEvent.changeText(screen.getByPlaceholderText('marc'), v.username);
  fireEvent.changeText(screen.getByPlaceholderText('Min 6 caractères'), v.password);
  fireEvent.changeText(screen.getByPlaceholderText('Re-tape le mot de passe'), v.confirm);
}

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
});

describe('Inscription (livreur seulement)', () => {
  it('ne propose plus le profil Fournisseur ni l’attente de validation', () => {
    afficher();
    expect(screen.queryByText('Fournisseur')).toBeNull();
    expect(screen.queryByText('Type de compte')).toBeNull();
    expect(screen.queryByText(/valider/i)).toBeNull();
  });

  it('envoie le profil LIVREUR et affiche le message de succès de la spec', async () => {
    register.mockResolvedValue({ message: 'Compte créé. Vous pouvez vous connecter.' });
    afficher();
    remplir();
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
    expect(register).toHaveBeenCalledTimes(1);
    expect(register.mock.calls[0][0]).toMatchObject({
      prenom: 'Awa',
      nom: 'Kone',
      contact: '0712345678',
      username: 'awa',
      password: 'secret1',
      profile: 'LIVREUR',
    });
    const d = useDialogStore.getState();
    expect(d.variant).toBe('success');
    expect([d.title, d.message]).toContain('Compte créé. Vous pouvez vous connecter.');
  });

  it('règles A7 : message de la spec, rien n’est envoyé', () => {
    afficher();
    remplir({ contact: '071234' });
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(useDialogStore.getState().message).toBe('Le numéro doit contenir 10 chiffres.');
    remplir({ password: '123', confirm: '123' });
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(useDialogStore.getState().message).toBe('Le mot de passe doit contenir au moins 6 caractères.');
    expect(register).not.toHaveBeenCalled();
  });

  it('double appui : un seul envoi', async () => {
    let resoudre: (v: unknown) => void = () => {};
    register.mockReturnValue(new Promise((r) => (resoudre = r)));
    afficher();
    remplir();
    fireEvent.press(screen.getByText('Créer mon compte'));
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    resoudre({ message: 'ok' });
    await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('erreur du back : message affiché tel quel', async () => {
    register.mockRejectedValue({ response: { status: 400, data: { success: false, message: "Ce nom d'utilisateur est déjà utilisé !" } } });
    afficher();
    remplir();
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(useDialogStore.getState().variant).toBe('error'));
    expect(useDialogStore.getState().message).toBe("Ce nom d'utilisateur est déjà utilisé !");
  });
});
