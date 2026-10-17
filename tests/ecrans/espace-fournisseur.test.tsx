import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import FournisseurLayout from '../../app/fournisseur/_layout';
import AccueilFournisseur from '../../app/fournisseur/index';
import NotificationsFournisseur from '../../app/fournisseur/notifications';
import MoiFournisseur from '../../app/fournisseur/moi/index';
import ModifierInfosFournisseur from '../../app/fournisseur/moi/infos';
import ChangerMotDePasseFournisseur from '../../app/fournisseur/moi/password';
import * as hooks from '../../features/fournisseur/hooks';
import { authApi } from '../../features/auth/api';
import { naviguer, ouvrir, revenirA } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { moisDe, moisVoisin } from '../../features/fournisseur/regles';
import type { CommandeResponse, NotificationResponse } from '../../types/api';

jest.mock('expo-router', () => {
  const { Text: T } = jest.requireActual('react-native');
  const Tabs = ({ children }: { children: React.ReactNode }) => <>{children}</>;
  Tabs.Screen = ({ name, options }: { name: string; options?: { title?: string; tabBarBadge?: unknown; href?: null } }) => (
    <T>{`onglet:${name}:${options?.title ?? ''}:${options?.tabBarBadge ?? ''}:${options?.href === null ? 'masque' : ''}`}</T>
  );
  return {
    usePathname: () => '/fournisseur',
    router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
    useNavigation: () => ({ getState: () => undefined }),
    useFocusEffect: jest.fn(),
    Redirect: ({ href }: { href: string }) => <T>{`redirection:${href}`}</T>,
    Tabs,
    Stack: () => null,
  };
});
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
  revenirApresEnregistrement: jest.fn(),
  origineDe: jest.fn(() => null),
  useRetourMateriel: jest.fn(),
}));
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
const FOURNISSEUR = {
  id: 'f-u1',
  prenom: 'Ali',
  nom: 'Kone',
  username: 'ali',
  contact: '0712345678',
  email: '',
  parentId: null,
  profile: 'FOURNISSEUR',
};
let mockUser: Record<string, unknown> | null = FOURNISSEUR;
const mockLogout = jest.fn(async () => {});
jest.mock('../../stores/authStore', () => {
  const useAuthStore = (sel: (s: unknown) => unknown) => sel({ user: mockUser, logout: mockLogout });
  useAuthStore.setState = jest.fn();
  return { useAuthStore };
});
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ theme: 'system', setTheme: jest.fn(), effective: 'light' }),
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true, startWatching: jest.fn() }),
}));
jest.mock('../../features/abonnement/hooks', () => ({ useMonAbonnement: () => ({ data: null, refetch: jest.fn() }) }));
jest.mock('../../features/auth/api', () => ({ authApi: { updateProfile: jest.fn(), changePassword: jest.fn() } }));
jest.mock('../../lib/image-picker', () => ({ pickImage: jest.fn() }));
jest.mock('../../features/photos/hooks', () => ({
  useUploadMaPhoto: () => ({ mutate: jest.fn(), isPending: false }),
  useSupprimerMaPhoto: () => ({ mutate: jest.fn(), isPending: false }),
}));

let mockFil: NotificationResponse[] = [];
let mockNonLues = 0;
const mockMarquerLue = jest.fn();
jest.mock('../../features/notifications/hooks', () => ({
  useFilNotifications: () => ({
    data: { pages: [mockFil] },
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
    fetchNextPage: jest.fn(),
  }),
  useNombreNonLues: () => ({ data: mockNonLues, refetch: jest.fn() }),
  useMarquerLue: () => ({ mutate: mockMarquerLue }),
  useToutMarquerLu: () => ({ mutate: jest.fn(), isPending: false }),
  useRelireAuFocus: jest.fn(),
}));

jest.mock('../../features/fournisseur/hooks', () => ({
  useFournisseurProfil: jest.fn(),
  useSyntheseFournisseur: jest.fn(),
  useReversementsSyntheseFournisseur: jest.fn(),
  useCommandesFournisseur: jest.fn(),
  useLivreursPartenaires: jest.fn(),
  useCompteInvitations: jest.fn(),
  useDemandesModifFournisseurEnAttente: jest.fn(),
}));

const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});
const m = <T extends keyof typeof hooks>(nom: T) => hooks[nom] as unknown as jest.Mock;

const SYNTHESE = {
  annee: 2026,
  mois: 10,
  totalVerse: 150000,
  remiseLivreurCumuleeMois: 12000,
  remiseLivreurDejaReversee: 4000,
  remiseLivreurAReverser: 8000,
  nbVersements: 3,
  nbLivreursActifs: 2,
  topLivreurs: [
    { livreurId: 'l1', prenom: 'Awa', nom: 'Yao', totalVerse: 100000, remiseLivreurCumulee: 8000, nbVersements: 2 },
    { livreurId: 'l2', prenom: 'Marc', nom: 'Konan', totalVerse: 50000, remiseLivreurCumulee: 4000, nbVersements: 1 },
  ],
};
const mois = moisDe();
const commandes = [
  { statut: 'ENVOYEE', montantEstime: 20000 },
  { statut: 'ENVOYEE', montantEstime: 5000 },
  { statut: 'LIVREE', dateLivraison: `${mois}-02T10:00:00`, montantLivre: 30000 },
] as CommandeResponse[];

function donnees() {
  m('useFournisseurProfil').mockReturnValue(lecture({ id: 'f1', libelle: 'Boulangerie 2000' }));
  m('useSyntheseFournisseur').mockReturnValue(lecture(SYNTHESE));
  m('useReversementsSyntheseFournisseur').mockReturnValue(
    lecture({
      annee: 2026,
      mois: 10,
      aReverserAuxLivreurs: [
        { livreurId: 'l1', prenom: 'Awa', nom: 'Yao', remiseLivreurCumuleeMois: 8000, detteCourante: 2000, montantNetAReverser: 6000 },
      ],
    }),
  );
  m('useCommandesFournisseur').mockReturnValue(lecture(commandes));
  m('useLivreursPartenaires').mockReturnValue(
    lecture([
      { livreur: { id: 'l1' }, du: 7000, remiseAReverser: 1000 },
      { livreur: { id: 'l2' }, du: -500, remiseAReverser: 0 },
    ]),
  );
  m('useCompteInvitations').mockReturnValue(lecture(1));
  m('useDemandesModifFournisseurEnAttente').mockReturnValue(
    lecture([
      { statut: 'PENDING', demandeurType: 'LIVREUR' },
      { statut: 'PENDING', demandeurType: 'FOURNISSEUR' },
    ]),
  );
}

function rendu(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = FOURNISSEUR;
  mockFil = [];
  mockNonLues = 0;
  donnees();
});

describe('F1 : coque de l’espace fournisseur', () => {
  it('fournisseur : cinq onglets, Notifications hors barre, badges des rubriques à traiter', () => {
    rendu(<FournisseurLayout />);
    expect(screen.getByText('onglet:index:Accueil::')).toBeTruthy();
    expect(screen.getByText('onglet:commandes:Commandes:2:')).toBeTruthy();
    expect(screen.getByText('onglet:livreurs:Livreurs:1:')).toBeTruthy();
    expect(screen.getByText('onglet:argent:Argent:1:')).toBeTruthy();
    expect(screen.getByText('onglet:moi:Moi::')).toBeTruthy();
    expect(screen.getByText('onglet:notifications:::masque')).toBeTruthy();
  });

  it.each([
    ['LIVREUR', '/(livreur)'],
    ['ADMIN', '/portail-web'],
  ])('%s : renvoyé à son accueil, aucune requête fournisseur', (profile, cible) => {
    mockUser = { ...FOURNISSEUR, profile };
    rendu(<FournisseurLayout />);
    expect(screen.getByText(`redirection:${cible}`)).toBeTruthy();
    expect(screen.queryByText(/onglet:/)).toBeNull();
    expect(m('useCommandesFournisseur')).not.toHaveBeenCalled();
  });
});

describe('F2 : Accueil du fournisseur (synthèse du portail web)', () => {
  it('données : entreprise, synthèse du mois, commandes, livreurs, à reverser, top livreurs', () => {
    rendu(<AccueilFournisseur />);
    expect(screen.getByText('Boulangerie 2000')).toBeTruthy();
    expect(screen.getByText('Total reçu ce mois')).toBeTruthy();
    expect(screen.getByText('150 000')).toBeTruthy();
    expect(screen.getByText('3 versements')).toBeTruthy();
    expect(screen.getByLabelText('Livreurs actifs : 2')).toBeTruthy();
    expect(screen.getByLabelText('Remise déjà reversée : 4 000 F')).toBeTruthy();
    expect(screen.getByText('8 000 F')).toBeTruthy();
    expect(screen.getByText('sur 12 000 F dûs ce mois')).toBeTruthy();
    // Commandes : 2 en attente (25 000 estimés), 1 livrée ce mois (30 000).
    expect(screen.getByLabelText('En attente : 2')).toBeTruthy();
    expect(screen.getByText('25 000 F estimés')).toBeTruthy();
    expect(screen.getByLabelText('Livrées ce mois : 1')).toBeTruthy();
    expect(screen.getByText('30 000 F livrés')).toBeTruthy();
    // Livreurs : dû = dûs positifs seulement.
    expect(screen.getByLabelText('Dû des livreurs : 7 000 F')).toBeTruthy();
    expect(screen.getByText('1 livreur sur 2')).toBeTruthy();
    // À reverser aux livreurs et top livreurs.
    expect(screen.getByText('6 000 F')).toBeTruthy();
    expect(screen.getByText('Remise du mois 8 000 F · dette −2 000 F')).toBeTruthy();
    expect(screen.getByText('Marc Konan')).toBeTruthy();
    expect(screen.getByText('2 versements · remise livreur 8 000 F')).toBeTruthy();
    expect(m('useSyntheseFournisseur')).toHaveBeenCalledWith(mois);
  });

  it('accueil sans bloc « À traiter » (ni lignes, ni erreurs de rubrique)', () => {
    rendu(<AccueilFournisseur />);
    expect(screen.queryByText('À traiter')).toBeNull();
    expect(screen.queryByLabelText('2 commandes à confirmer')).toBeNull();
    expect(screen.queryByLabelText('1 invitation de livreur')).toBeNull();
  });

  it('cloche : seules les non lues en badge, sans pastille orange ; ouvre les Notifications', () => {
    mockNonLues = 4;
    const { unmount } = rendu(<AccueilFournisseur />);
    const cloche = screen.getByLabelText('Notifications : 4 non lues');
    expect(within(cloche).getByText('4')).toBeTruthy();
    fireEvent.press(cloche);
    expect(ouvrir).toHaveBeenLastCalledWith('/fournisseur/notifications');
    unmount();
    mockNonLues = 0;
    rendu(<AccueilFournisseur />);
    expect(screen.queryByTestId('cloche-a-traiter')).toBeNull();
    expect(screen.getByLabelText('Notifications : 0 non lue')).toBeTruthy();
  });

  it('vide : rien à traiter (pas de bloc), aucun versement ni reversement ce mois', () => {
    m('useSyntheseFournisseur').mockReturnValue(lecture({ ...SYNTHESE, totalVerse: 0, nbVersements: 0, topLivreurs: [] }));
    m('useReversementsSyntheseFournisseur').mockReturnValue(lecture({ aReverserAuxLivreurs: [] }));
    m('useCommandesFournisseur').mockReturnValue(lecture([]));
    m('useCompteInvitations').mockReturnValue(lecture(0));
    m('useDemandesModifFournisseurEnAttente').mockReturnValue(lecture([]));
    rendu(<AccueilFournisseur />);
    expect(screen.queryByText('À traiter')).toBeNull();
    expect(screen.queryByTestId('cloche-a-traiter')).toBeNull();
    expect(screen.getByText('0 versement')).toBeTruthy();
    expect(screen.getByText('Aucun versement ce mois.')).toBeTruthy();
    expect(screen.getByText('Aucun reversement à effectuer ce mois.')).toBeTruthy();
  });

  it('chargement puis erreur : messages distincts, message du back tel quel, Réessayer', () => {
    m('useSyntheseFournisseur').mockReturnValue(lecture(undefined, { isLoading: true }));
    const { unmount } = rendu(<AccueilFournisseur />);
    expect(screen.getByLabelText('Chargement de la synthèse')).toBeTruthy();
    unmount();
    const refetch = jest.fn();
    m('useSyntheseFournisseur').mockReturnValue(
      lecture(undefined, {
        isError: true,
        refetch,
        error: { response: { status: 403, data: { message: 'Abonnement expiré.' } } },
      }),
    );
    m('useCommandesFournisseur').mockReturnValue(lecture(undefined, { isError: true, error: new Error('x') }));
    rendu(<AccueilFournisseur />);
    expect(screen.getByText('Synthèse indisponible')).toBeTruthy();
    expect(screen.getByText('Abonnement expiré.')).toBeTruthy();
    fireEvent.press(screen.getByText('Réessayer'));
    expect(refetch).toHaveBeenCalled();
    expect(screen.queryByText('Commandes à confirmer indisponibles')).toBeNull();
    expect(screen.getByLabelText('En attente : —')).toBeTruthy();
  });

  it('mois : précédent relit la synthèse de ce mois ; pas de mois futur', () => {
    rendu(<AccueilFournisseur />);
    expect(screen.getByLabelText('Mois suivant').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByLabelText('Mois précédent'));
    expect(m('useSyntheseFournisseur')).toHaveBeenLastCalledWith(moisVoisin(mois, -1));
    expect(m('useReversementsSyntheseFournisseur')).toHaveBeenLastCalledWith(moisVoisin(mois, -1));
    expect(screen.getByLabelText('Mois suivant').props.accessibilityState).toMatchObject({ disabled: false });
  });
});

describe('F2 : Notifications du fournisseur', () => {
  const notif = (over: Partial<NotificationResponse>): NotificationResponse => ({
    id: 'n1',
    type: 'COMMANDE_NOUVELLE',
    titre: 'Nouvelle commande',
    texte: 'Awa YAO t’a envoyé la commande CMDE-5.',
    cible: { type: 'COMMANDE', id: 'c5', route: 'fournisseur.commandes' },
    auteur: { id: 'a1', nom: 'Awa YAO' },
    creeLe: '2026-10-16T08:00:00',
    lue: false,
    ...over,
  });

  it('À traiter du fournisseur en haut, puis le fil ; une notification ouvre son écran de l’espace', () => {
    mockFil = [
      notif({}),
      notif({ id: 'n2', type: 'INVITATION_RECUE', cible: { type: 'RELATION', id: 'r1', route: 'fournisseur.invitations' } }),
    ];
    rendu(<NotificationsFournisseur />);
    expect(screen.getByText('À traiter')).toBeTruthy();
    expect(screen.getByLabelText('2 commandes à confirmer')).toBeTruthy();
    expect(screen.getByText('Fil d’activité')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-n1'));
    expect(mockMarquerLue).toHaveBeenCalledWith('n1');
    expect(ouvrir).toHaveBeenLastCalledWith('/fournisseur/commandes/c5', {});
    fireEvent.press(screen.getByTestId('notification-n2'));
    expect(ouvrir).toHaveBeenLastCalledWith('/fournisseur/livreurs/invitations', {});
  });

  it('rien à traiter et fil vide : « Aucune notification »', () => {
    m('useCommandesFournisseur').mockReturnValue(lecture([]));
    m('useCompteInvitations').mockReturnValue(lecture(0));
    m('useDemandesModifFournisseurEnAttente').mockReturnValue(lecture([]));
    rendu(<NotificationsFournisseur />);
    expect(screen.queryByText('À traiter')).toBeNull();
    expect(screen.getByText('Aucune notification')).toBeTruthy();
  });
});

describe('F2 : onglet Moi du fournisseur', () => {
  it('entreprise et compte, liens Mes infos, mot de passe, catalogue, Notifications', () => {
    mockNonLues = 3;
    rendu(<MoiFournisseur />);
    expect(screen.getByText('Boulangerie 2000')).toBeTruthy();
    expect(screen.getByText('ali · Fournisseur')).toBeTruthy();
    expect(screen.getByText('0712345678')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Modifier mes infos'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/moi/infos');
    fireEvent.press(screen.getByLabelText('Changer le mot de passe'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/moi/password');
    fireEvent.press(screen.getByLabelText('Mon catalogue'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/moi/catalogue');
    expect(screen.getByText('3 non lues')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(ouvrir).toHaveBeenLastCalledWith('/fournisseur/notifications');
    expect(screen.getByText('Sombre')).toBeTruthy();
  });

  it('déconnexion après confirmation', async () => {
    rendu(<MoiFournisseur />);
    fireEvent.press(screen.getByText('Se déconnecter'));
    const options = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(options.title).toBe('Déconnexion');
    await act(async () => {
      await options.onConfirm();
    });
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('Mes infos (règle du téléphone 01/05/07) : retour à Moi après l’enregistrement', async () => {
    (authApi.updateProfile as jest.Mock).mockResolvedValue({ ...FOURNISSEUR, contact: '0512345678' });
    rendu(<ModifierInfosFournisseur />);
    fireEvent.changeText(screen.getByDisplayValue('0712345678'), '0812345678');
    fireEvent.press(screen.getByText('Enregistrer'));
    expect(dialog.warning).toHaveBeenCalledWith(
      'Champs invalides',
      'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.',
    );
    fireEvent.changeText(screen.getByDisplayValue('0812345678'), '0512345678');
    fireEvent.press(screen.getByText('Enregistrer'));
    await waitFor(() => expect(revenirA).toHaveBeenCalledWith('/fournisseur/moi'));
  });

  it('mot de passe : retour à Moi après le changement', async () => {
    (authApi.changePassword as jest.Mock).mockResolvedValue({ message: 'ok' });
    rendu(<ChangerMotDePasseFournisseur />);
    const champs = screen.getAllByPlaceholderText('••••••••');
    fireEvent.changeText(champs[0], 'ancien1');
    fireEvent.changeText(champs[1], 'nouveau1');
    fireEvent.changeText(champs[2], 'nouveau1');
    fireEvent.press(screen.getByText('Mettre à jour'));
    await waitFor(() => expect(revenirA).toHaveBeenCalledWith('/fournisseur/moi'));
    expect(authApi.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ currentPassword: 'ancien1', newPassword: 'nouveau1' }),
      expect.anything(),
    );
  });
});
