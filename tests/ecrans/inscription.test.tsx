import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from 'expo-router';
import Signup from '../../app/(auth)/signup';
import { authApi } from '../../features/auth/api';
import { useDialogStore } from '../../stores/dialogStore';

jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
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

const INFOS = { prenom: 'Awa', nom: 'Kone', contact: '0712345678' };
const ACCES = { username: 'awa', password: 'secret1', confirm: 'secret1' };

function remplirInfos(patch: Partial<typeof INFOS> = {}) {
  const v = { ...INFOS, ...patch };
  fireEvent.changeText(screen.getByPlaceholderText('Marc'), v.prenom);
  fireEvent.changeText(screen.getByPlaceholderText('Konan'), v.nom);
  fireEvent.changeText(screen.getByPlaceholderText('0712345678'), v.contact);
}

function remplirAcces(patch: Partial<typeof ACCES> = {}) {
  const v = { ...ACCES, ...patch };
  fireEvent.changeText(screen.getByPlaceholderText('marc'), v.username);
  fireEvent.changeText(screen.getByPlaceholderText('Min 6 caractères'), v.password);
  fireEvent.changeText(screen.getByPlaceholderText('Re-tape le mot de passe'), v.confirm);
}

const continuer = () => fireEvent.press(screen.getByText('Continuer'));

/** Profil et informations valides (étape 1) → accès (étape 2). */
function allerAuxAcces() {
  afficher();
  remplirInfos();
  continuer();
}

/** Appui sur le bouton retour Android : vrai si l'écran l'a pris en charge. */
function retourAndroid(): boolean {
  const appels = (BackHandler.addEventListener as jest.Mock).mock.calls;
  const [, gestionnaire] = appels[appels.length - 1];
  let pris = false;
  act(() => {
    pris = gestionnaire();
  });
  return pris;
}

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
  jest.spyOn(BackHandler, 'addEventListener');
});

describe('Inscription en deux étapes (livreur seulement)', () => {
  it('étape 1 : profil Livreur choisi, informations, progression 1/2, ni Fournisseur ni attente de validation', () => {
    afficher();
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Profil et informations' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Livreur' }).props.accessibilityState).toEqual({ checked: true });
    expect(screen.queryByText('Fournisseur')).toBeNull();
    expect(screen.getByText('Fournisseur ? Inscris-toi sur le portail web.')).toBeTruthy();
    expect(screen.getByPlaceholderText('Marc')).toBeTruthy();
    expect(screen.queryByPlaceholderText('marc')).toBeNull();
    expect(screen.queryByText(/valider/i)).toBeNull();
    fireEvent.press(screen.getByText('Se connecter'));
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });

  it('étape 1 : la flèche retour ramène à la connexion', () => {
    afficher();
    fireEvent.press(screen.getByLabelText('Retour à la connexion'));
    expect(router.back).toHaveBeenCalled();
  });

  it('étape 1 vérifiée avant « Continuer » : message A7, on reste à l’étape 1', () => {
    afficher();
    continuer();
    expect(useDialogStore.getState().message).toBe('Le prénom doit contenir entre 2 et 50 caractères.');
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
    expect(screen.getByText('10 chiffres, commence par 01, 05 ou 07')).toBeTruthy();
    remplirInfos({ contact: '071234' });
    continuer();
    expect(useDialogStore.getState().message).toBe('Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.');
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
    remplirInfos({ prenom: 'A' });
    continuer();
    expect(useDialogStore.getState().message).toBe('Le prénom doit contenir entre 2 et 50 caractères.');
    expect(screen.queryByPlaceholderText('marc')).toBeNull();
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
  });

  it('retour (flèche et Android) : étape précédente, la saisie est gardée', () => {
    allerAuxAcces();
    expect(screen.getByText('Étape 2 sur 2')).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Accès' })).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('marc'), 'awa');
    fireEvent.press(screen.getByLabelText('Étape précédente'));
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
    expect(screen.getByPlaceholderText('Marc').props.value).toBe('Awa');
    expect(screen.getByPlaceholderText('0712345678').props.value).toBe('0712345678');
    continuer();
    expect(screen.getByPlaceholderText('marc').props.value).toBe('awa');
    expect(retourAndroid()).toBe(true);
    expect(screen.getByText('Étape 1 sur 2')).toBeTruthy();
    // Étape 1 : le retour Android n'est pas pris (retour normal à la connexion).
    expect(retourAndroid()).toBe(false);
  });

  it('envoie le profil LIVREUR et affiche le message de succès de la spec', async () => {
    register.mockResolvedValue({ message: 'Compte créé. Vous pouvez vous connecter.' });
    allerAuxAcces();
    remplirAcces();
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

  it('règles A7 à l’étape 2 : message de la spec, rien n’est envoyé', () => {
    allerAuxAcces();
    remplirAcces({ password: '123', confirm: '123' });
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(useDialogStore.getState().message).toBe('Le mot de passe doit contenir au moins 6 caractères.');
    remplirAcces({ confirm: 'autre12' });
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(useDialogStore.getState().message).toBe('Les mots de passe ne correspondent pas');
    remplirAcces({ username: 'ab' });
    fireEvent.press(screen.getByText('Créer mon compte'));
    expect(useDialogStore.getState().message).toBe("Le nom d'utilisateur doit contenir entre 3 et 50 caractères.");
    expect(register).not.toHaveBeenCalled();
  });

  it('double appui : un seul envoi', async () => {
    let resoudre: (v: unknown) => void = () => {};
    register.mockReturnValue(new Promise((r) => (resoudre = r)));
    allerAuxAcces();
    remplirAcces();
    fireEvent.press(screen.getByText('Créer mon compte'));
    fireEvent.press(screen.getByLabelText('Créer mon compte'));
    await waitFor(() => expect(register).toHaveBeenCalledTimes(1));
    resoudre({ message: 'ok' });
    await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
    expect(register).toHaveBeenCalledTimes(1);
  });

  it('erreur du back : message affiché tel quel', async () => {
    register.mockRejectedValue({ response: { status: 400, data: { success: false, message: "Ce nom d'utilisateur est déjà utilisé !" } } });
    allerAuxAcces();
    remplirAcces();
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(useDialogStore.getState().variant).toBe('error'));
    expect(useDialogStore.getState().message).toBe("Ce nom d'utilisateur est déjà utilisé !");
  });

  it('succès : « Se connecter » ouvre la connexion', async () => {
    register.mockResolvedValue({ message: 'ok' });
    allerAuxAcces();
    remplirAcces();
    fireEvent.press(screen.getByText('Créer mon compte'));
    await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
    act(() => {
      useDialogStore.getState().actions!.find((a) => a.label === 'Se connecter')!.onPress!();
    });
    expect(router.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
