import { act, fireEvent, render, screen } from '@testing-library/react-native';
import MesRemises from '../../app/(livreur)/profil/remises/index';
import NouvelleRemise from '../../app/(livreur)/profil/remises/nouvelle';
import RemisesApprentis from '../../app/(livreur)/profil/remises-apprentis';
import ApprentiDetail from '../../app/(livreur)/profil/apprentis/[id]';
import NouvelleCloture from '../../app/(livreur)/clotures/nouvelle';
import { dialog } from '../../lib/dialog';
import { revenirApresEnregistrement, naviguer } from '../../lib/navigation-app';
import { PILES_IMBRIQUEES, ROUTES } from '../../lib/navigation';
import * as hooks from '../../features/remises-argent/hooks';
import type { RemiseArgentResponse, StatutRemiseArgent } from '../../types/api';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  usePathname: () => '/profil/remises',
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
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
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
let mockUser: Record<string, unknown> = { id: 'A1', prenom: 'Issa', nom: 'B', parentId: 'P1' };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../features/remises-argent/hooks', () => ({
  useMesRemises: jest.fn(),
  useRemisesApprentis: jest.fn(),
  useRemisesAConfirmer: jest.fn(),
  useDeclarerRemise: jest.fn(),
  useAnnulerRemise: jest.fn(),
  useConfirmerRemise: jest.fn(),
  useContesterRemise: jest.fn(),
}));
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({
    data: [
      { id: 'A1', prenom: 'Issa', nom: 'B' },
      { id: 'A2', prenom: 'Moussa', nom: 'C' },
    ],
    isLoading: false,
    refetch: jest.fn(),
  }),
  useToggleApprentiActif: () => ({ mutate: jest.fn(), isPending: false }),
}));
const mockVide = () => ({ data: [], isLoading: false, isError: false, isFetching: false, refetch: jest.fn() });
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsByLivreur: () => mockVide() }));
jest.mock('../../features/encaissements/hooks', () => ({ useEncaissementsByLivreur: () => mockVide() }));
jest.mock('../../features/clients/hooks', () => ({
  useClientsByLivreur: () => mockVide(),
  useEncoursByLivreur: () => mockVide(),
}));
jest.mock('../../features/stock/hooks', () => ({ useStockActuel: () => mockVide() }));
jest.mock('../../features/clotures/hooks', () => ({
  useEnregistrerCloture: () => ({ mutate: jest.fn(), isPending: false }),
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const h = hooks as unknown as Record<string, jest.Mock>;
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: jest.fn(),
  ...etat,
});
const mutation = () => ({ mutate: jest.fn(), isPending: false });
const remise = (
  id: string,
  statut: StatutRemiseArgent = 'DECLAREE',
  extra: Partial<RemiseArgentResponse> = {},
): RemiseArgentResponse => ({
  id,
  reference: `REM-${id}`,
  apprenti: { id: 'A1', prenom: 'Issa', nom: 'B' } as never,
  principal: { id: 'P1', prenom: 'Awa', nom: 'K' } as never,
  montant: 5000,
  dateRemise: '2026-10-10T09:00:00',
  commentaire: null,
  statut,
  motifContestation: null,
  decideParId: null,
  dateDecision: null,
  clotureId: null,
  ...extra,
});
/** Bouton « Contester » de la fenêtre (rendue après la liste, donc le dernier). */
const envoyerContestation = () => {
  const boutons = screen.getAllByText('Contester');
  fireEvent.press(boutons[boutons.length - 1]);
};
/** Dernier `dialog.confirm` : on simule l'appui sur le bouton de confirmation. */
const confirmerDialogue = () => {
  const appels = (dialog.confirm as jest.Mock).mock.calls;
  appels[appels.length - 1][0].onConfirm();
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockUser = { id: 'A1', prenom: 'Issa', nom: 'B', parentId: 'P1' };
  for (const n of ['useDeclarerRemise', 'useAnnulerRemise', 'useConfirmerRemise', 'useContesterRemise'])
    h[n].mockReturnValue(mutation());
  h.useMesRemises.mockReturnValue(lecture([]));
  h.useRemisesApprentis.mockReturnValue(lecture([]));
  h.useRemisesAConfirmer.mockReturnValue(lecture([]));
});

describe('Mes remises (apprenti)', () => {
  it('liste : référence, montant, statut, motif si contestée ; « Nouvelle remise » ouvre le formulaire', () => {
    h.useMesRemises.mockReturnValue(
      lecture([
        remise('2', 'CONTESTEE', { motifContestation: 'Il manque 500' }),
        remise('1', 'CONFIRMEE', { commentaire: 'Clôture du 09/10/2026' }),
      ]),
    );
    render(<MesRemises />);
    expect(screen.getByText('REM-2')).toBeTruthy();
    expect(screen.getByText('Contestée')).toBeTruthy();
    expect(screen.getByText('Motif : Il manque 500')).toBeTruthy();
    expect(screen.getByText('Confirmée')).toBeTruthy();
    expect(screen.getByText('Clôture du 09/10/2026')).toBeTruthy();
    // Aucune remise déclarée : pas d'annulation possible.
    expect(screen.queryByText('Annuler')).toBeNull();
    fireEvent.press(screen.getByText('Nouvelle remise'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/profil/remises/nouvelle');
  });

  it('erreur de chargement distincte de la liste vide', () => {
    h.useMesRemises.mockReturnValue(lecture(undefined, { isError: true }));
    render(<MesRemises />);
    expect(screen.getByText('Chargement impossible')).toBeTruthy();
    expect(screen.queryByText('Aucune remise')).toBeNull();
  });

  it('annuler une remise déclarée : confirmation, un seul envoi, erreur du back affichée', () => {
    const annuler = mutation();
    h.useAnnulerRemise.mockReturnValue(annuler);
    h.useMesRemises.mockReturnValue(lecture([remise('1')]));
    render(<MesRemises />);
    fireEvent.press(screen.getByText('Annuler'));
    expect(dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Annuler la remise REM-1 ?',
        message: expect.stringMatching(/^5\s000 FCFA : la remise ne sera plus proposée à ton livreur principal\.$/),
        confirmLabel: 'Annuler la remise',
        destructive: true,
      }),
    );
    confirmerDialogue();
    confirmerDialogue();
    expect(annuler.mutate).toHaveBeenCalledTimes(1);
    expect(annuler.mutate.mock.calls[0][0]).toBe('1');
    const options = annuler.mutate.mock.calls[0][1];
    options.onError({ response: { status: 400, data: { success: false, message: 'Cette remise a déjà été traitée.' } } });
    expect(dialog.error).toHaveBeenCalledWith(expect.any(String), 'Cette remise a déjà été traitée.');
    options.onSettled();
    confirmerDialogue();
    expect(annuler.mutate).toHaveBeenCalledTimes(2);
  });
});

describe('Nouvelle remise (apprenti)', () => {
  it('déclare montant et commentaire, un seul envoi, puis retour à la liste', () => {
    const declarer = mutation();
    h.useDeclarerRemise.mockReturnValue(declarer);
    render(<NouvelleRemise />);
    expect(screen.getByText(/déclarée à ton principal/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Montant remis'), '5000');
    fireEvent.changeText(screen.getByLabelText('Commentaire'), '  recette du matin ');
    fireEvent.press(screen.getByText('Déclarer'));
    fireEvent.press(screen.getByText('Déclarer'));
    expect(declarer.mutate).toHaveBeenCalledTimes(1);
    expect(declarer.mutate.mock.calls[0][0]).toEqual({ montant: 5000, commentaire: 'recette du matin' });
    declarer.mutate.mock.calls[0][1].onSuccess(remise('3'));
    expect(revenirApresEnregistrement).toHaveBeenCalledWith('/(livreur)/profil/remises', null);
    expect(dialog.success).toHaveBeenCalledWith('Remise déclarée', expect.stringContaining('REM-3'));
  });

  it('montant nul : message du back, aucun envoi', () => {
    const declarer = mutation();
    h.useDeclarerRemise.mockReturnValue(declarer);
    render(<NouvelleRemise />);
    fireEvent.changeText(screen.getByLabelText('Montant remis'), '0');
    fireEvent.press(screen.getByText('Déclarer'));
    expect(screen.getByText('Le montant doit être supérieur à 0.')).toBeTruthy();
    expect(declarer.mutate).not.toHaveBeenCalled();
  });

  it('refus du back affiché (message exact)', () => {
    const declarer = mutation();
    h.useDeclarerRemise.mockReturnValue(declarer);
    render(<NouvelleRemise />);
    fireEvent.changeText(screen.getByLabelText('Montant remis'), '100');
    fireEvent.press(screen.getByText('Déclarer'));
    act(() =>
      declarer.mutate.mock.calls[0][1].onError({
        response: { status: 403, data: { message: 'Accès refusé : Seul un apprenti peut déclarer une remise.' } },
      }),
    );
    expect(screen.getByText('Accès refusé : Seul un apprenti peut déclarer une remise.')).toBeTruthy();
  });
});

describe('Remises des apprentis (principal)', () => {
  beforeEach(() => {
    mockUser = { id: 'P1', prenom: 'Awa', nom: 'K', parentId: null };
  });

  it('filtres : apprenti venu de la fiche, statut ; liste avec l’apprenti', () => {
    mockParams = { apprentiId: 'A2' };
    h.useRemisesApprentis.mockReturnValue(lecture([remise('1')]));
    render(<RemisesApprentis />);
    expect(h.useRemisesApprentis).toHaveBeenLastCalledWith({ apprentiId: 'A2' });
    expect(screen.getByText(/· Issa B/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Statut Contestée'));
    expect(h.useRemisesApprentis).toHaveBeenLastCalledWith({ apprentiId: 'A2', statut: 'CONTESTEE' });
    fireEvent.press(screen.getByLabelText('Apprenti Tous'));
    expect(h.useRemisesApprentis).toHaveBeenLastCalledWith({ statut: 'CONTESTEE' });
  });

  it('confirmer : confirmation puis un seul envoi', () => {
    const confirmer = mutation();
    h.useConfirmerRemise.mockReturnValue(confirmer);
    h.useRemisesApprentis.mockReturnValue(lecture([remise('1'), remise('2', 'CONFIRMEE')]));
    render(<RemisesApprentis />);
    expect(screen.getAllByText('Confirmer')).toHaveLength(1);
    fireEvent.press(screen.getByText('Confirmer'));
    confirmerDialogue();
    confirmerDialogue();
    expect(confirmer.mutate).toHaveBeenCalledTimes(1);
    expect(confirmer.mutate.mock.calls[0][0]).toBe('1');
    confirmer.mutate.mock.calls[0][1].onError({
      response: { status: 400, data: { message: 'Cette remise a déjà été traitée.' } },
    });
    expect(dialog.error).toHaveBeenCalledWith('Confirmation impossible', 'Cette remise a déjà été traitée.');
  });

  it('contester sans motif : message, aucun envoi ; avec motif : envoyé', () => {
    const contester = mutation();
    h.useContesterRemise.mockReturnValue(contester);
    h.useRemisesApprentis.mockReturnValue(lecture([remise('1')]));
    render(<RemisesApprentis />);
    fireEvent.press(screen.getByText('Contester'));
    expect(screen.getByText('Contester la remise REM-1')).toBeTruthy();
    expect(screen.getByText('Motif')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Motif de la contestation'), '   ');
    envoyerContestation();
    expect(screen.getByText('Précisez le motif de la contestation.')).toBeTruthy();
    expect(contester.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Motif de la contestation'), ' Il manque 500 ');
    envoyerContestation();
    envoyerContestation();
    expect(contester.mutate).toHaveBeenCalledTimes(1);
    expect(contester.mutate.mock.calls[0][0]).toEqual({ id: '1', motif: 'Il manque 500' });
  });

  it('erreur de chargement distincte de la liste vide', () => {
    h.useRemisesApprentis.mockReturnValue(lecture(undefined, { isError: true }));
    render(<RemisesApprentis />);
    expect(screen.getByText('Chargement impossible')).toBeTruthy();
    expect(screen.queryByText('Aucune remise')).toBeNull();
  });
});

describe('Fiche apprenti : section Remises', () => {
  beforeEach(() => {
    mockUser = { id: 'P1', prenom: 'Awa', nom: 'K', parentId: null };
    mockParams = { id: 'A1' };
  });

  it('5 dernières remises de l’apprenti et lien vers la liste filtrée', () => {
    const liste = ['1', '2', '3', '4', '5', '6'].map((n) =>
      remise(n, 'CONFIRMEE', { dateRemise: `2026-10-0${n}T09:00:00` }),
    );
    h.useRemisesApprentis.mockReturnValue(lecture(liste));
    render(<ApprentiDetail />);
    expect(h.useRemisesApprentis).toHaveBeenCalledWith({ apprentiId: 'A1' }, true);
    expect(screen.getByText('Remises')).toBeTruthy();
    expect(screen.getByText('REM-6')).toBeTruthy();
    expect(screen.getByText('REM-2')).toBeTruthy();
    expect(screen.queryByText('REM-1')).toBeNull();
    fireEvent.press(screen.getByText('Voir toutes les remises'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/profil/remises-apprentis', { apprentiId: 'A1', depuis: 'apprenti' });
  });

  it('aucune remise, ou lecture impossible', () => {
    const { unmount } = render(<ApprentiDetail />);
    expect(screen.getByText('Aucune remise pour l’instant.')).toBeTruthy();
    unmount();
    h.useRemisesApprentis.mockReturnValue(lecture(undefined, { isError: true }));
    render(<ApprentiDetail />);
    expect(screen.getByText('Les remises n’ont pas pu être lues.')).toBeTruthy();
  });
});

describe('Clôture : texte d’aide du montant remis', () => {
  it('apprenti : une remise sera déclarée à son principal', () => {
    render(<NouvelleCloture />);
    expect(screen.getByText('Une remise sera déclarée à ton livreur principal.')).toBeTruthy();
  });

  it('principal : pas de texte', () => {
    mockUser = { id: 'P1', prenom: 'Awa', nom: 'K', parentId: null };
    render(<NouvelleCloture />);
    expect(screen.queryByText(/remise sera déclarée/)).toBeNull();
  });
});

describe('Navigation des remises', () => {
  it('ROUTES : écrans et parents', () => {
    expect(ROUTES['profil/remises/index']).toEqual({ type: 'liste', parent: '/profil' });
    expect(ROUTES['profil/remises/nouvelle']).toEqual({ type: 'formulaire', parent: '/profil/remises' });
    expect(ROUTES['profil/remises-apprentis']).toEqual({
      type: 'liste',
      parent: '/profil',
      origines: { apprenti: '/profil/apprentis/[apprentiId]' },
    });
    expect(PILES_IMBRIQUEES.has('profil/remises')).toBe(true);
  });
});
