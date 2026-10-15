import { fireEvent, render, screen } from '@testing-library/react-native';
import NouveauApprenti from '../../app/(livreur)/profil/apprentis/nouveau';
import { useDialogStore } from '../../stores/dialogStore';

const mockMutate = jest.fn();
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() } }));
jest.mock('../../features/apprentis/hooks', () => ({
  useCreerApprenti: () => ({ mutate: mockMutate, isPending: false }),
}));
jest.mock('../../lib/useRetourListe', () => ({ useRetourListe: () => jest.fn() }));
jest.mock('../../components/shared/PageHeader', () => ({ PageHeader: () => null }));

function remplir(patch: Partial<Record<string, string>> = {}) {
  const v = { prenom: 'Paul', nom: 'Diallo', contact: '0712345678', username: 'paul', password: 'secret1', ...patch };
  fireEvent.changeText(screen.getByPlaceholderText('Paul'), v.prenom);
  fireEvent.changeText(screen.getByPlaceholderText('Diallo'), v.nom);
  fireEvent.changeText(screen.getByPlaceholderText('0712345678'), v.contact);
  fireEvent.changeText(screen.getByPlaceholderText('paul'), v.username);
  fireEvent.changeText(screen.getByPlaceholderText('Min 6 caractères'), v.password);
}

function creer(patch: Partial<Record<string, string>> = {}) {
  render(<NouveauApprenti />);
  remplir(patch);
  fireEvent.press(screen.getByText("Créer l'apprenti"));
}

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
});

describe('Nouvel apprenti : règles A7 de l’inscription', () => {
  it.each([
    [{ prenom: 'P' }, 'Le prénom doit contenir entre 2 et 50 caractères.'],
    [{ nom: 'Diallo2' }, 'Le nom ne doit contenir que des lettres, espaces, tirets, apostrophes ou points.'],
    [{ nom: 'x'.repeat(51) }, 'Le nom doit contenir entre 2 et 50 caractères.'],
    [{ contact: '071234567' }, 'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.'],
    [{ contact: '0212345678' }, 'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.'],
    [{ username: 'pa' }, "Le nom d'utilisateur doit contenir entre 3 et 50 caractères."],
    [{ username: 'p'.repeat(51) }, "Le nom d'utilisateur doit contenir entre 3 et 50 caractères."],
    [{ password: '      ' }, 'Le mot de passe doit contenir au moins 6 caractères.'],
  ])('%j refusé avec le message de l’inscription', (patch, attendu) => {
    creer(patch);
    expect(useDialogStore.getState().open).toBe(true);
    expect(useDialogStore.getState().message).toBe(attendu);
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('valeurs valides : envoyées nettoyées', () => {
    creer({ prenom: ' Paul ', username: ' paul ' });
    expect(mockMutate).toHaveBeenCalledTimes(1);
    expect(mockMutate.mock.calls[0][0]).toEqual({
      prenom: 'Paul',
      nom: 'Diallo',
      contact: '0712345678',
      email: '',
      username: 'paul',
      password: 'secret1',
    });
  });
});
