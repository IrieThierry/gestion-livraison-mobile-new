import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Text } from 'react-native';
import { EcranNotifications } from '../../components/notifications/EcranNotifications';
import { apiClient } from '../../lib/api-client';
import { ouvrir } from '../../lib/navigation-app';
import type { NotificationResponse } from '../../types/api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), put: jest.fn() } }));
const mockFocus: Array<() => void> = [];
jest.mock('expo-router', () => ({
  usePathname: () => '/previsions/echues',
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
  useFocusEffect: (cb: () => void) => {
    // Enregistre l'effet : le test simule les reprises de focus.
    const { useEffect } = jest.requireActual('react');
    useEffect(() => {
      mockFocus.push(cb);
      cb();
    }, [cb]);
  },
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
let mockUser: Record<string, unknown> = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

const get = apiClient.get as jest.Mock;
const put = apiClient.put as jest.Mock;

const p2 = (n: number) => String(n).padStart(2, '0');
const local = (d: Date) =>
  `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
const ilYA = (minutes: number) => local(new Date(Date.now() - minutes * 60_000));

const notif = (over: Partial<NotificationResponse> = {}): NotificationResponse => ({
  id: 'n1',
  type: 'TRANSFERT_RECU',
  titre: 'Bon de transfert à valider',
  texte: 'Ali KONÉ t’a envoyé le bon TRF-3 (2 produits).',
  cible: { type: 'TRANSFERT', id: 't1', route: 'transferts.a-decider' },
  auteur: { id: 'a1', nom: 'Ali KONÉ' },
  creeLe: ilYA(5),
  lue: false,
  ...over,
});

let pages: Record<string, NotificationResponse[]>;
let nonLues: number;
let echecFil: boolean;

function routerApi() {
  get.mockImplementation((url: string, config?: { params?: { avant?: string } }) => {
    if (url === '/notification/me/non-lues/compte') return Promise.resolve({ data: { nonLues } });
    if (url === '/notification/me') {
      if (echecFil) return Promise.reject(new Error('réseau'));
      return Promise.resolve({ data: pages[config?.params?.avant ?? 'debut'] ?? [] });
    }
    return Promise.reject(new Error(`inattendu ${url}`));
  });
  put.mockImplementation((url: string) => {
    // Serveur simulé : le marquage persiste pour les relectures.
    const marquer = (id?: string) => {
      for (const k of Object.keys(pages)) pages[k] = pages[k].map((n) => (!id || n.id === id ? { ...n, lue: true } : n));
      nonLues = Object.values(pages).flat().filter((n) => !n.lue).length;
    };
    if (url === '/notification/me/toutes-lues') {
      marquer();
      return Promise.resolve({ data: { nonLues: 0 } });
    }
    const m = /^\/notification\/(.+)\/lue$/.exec(url);
    if (m) {
      marquer(m[1]);
      return Promise.resolve({ data: { ...notif({ id: m[1] }), lue: true } });
    }
    return Promise.reject(new Error(`inattendu ${url}`));
  });
}

const rafraichir = jest.fn();
const clients: QueryClient[] = [];
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((qc) => qc.clear());
});
function rendre(aTraiter: React.ReactNode = <Text>Section à traiter</Text>) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { gcTime: Infinity } },
  });
  clients.push(qc);
  return render(
    <QueryClientProvider client={qc}>
      <EcranNotifications aTraiter={aTraiter} onRafraichir={rafraichir} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFocus.length = 0;
  mockUser = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: null };
  nonLues = 1;
  echecFil = false;
  pages = {
    debut: [
      notif({ id: 'n1' }),
      notif({
        id: 'n2',
        type: 'REMISE_CONFIRMEE',
        titre: 'Remise confirmée',
        texte: 'Awa TRAORÉ a confirmé ta remise REM-4 de 15 000 F CFA.',
        cible: { type: 'REMISE_ARGENT', id: 'r1', route: 'remises.mes-remises' },
        auteur: { id: 'a2', nom: 'Awa TRAORÉ' },
        creeLe: ilYA(1),
        lue: true,
      }),
      notif({
        id: 'n3',
        type: 'COMMANDE_LIVREE',
        titre: 'Commande livrée',
        texte: 'BRASSERIE DU SUD a livré la commande CMDE-5 : elle est prête à être réceptionnée.',
        cible: { type: 'COMMANDE', id: 'c1', route: 'commandes' },
        auteur: { id: 'f1', nom: 'BRASSERIE DU SUD' },
        creeLe: ilYA(60 * 24 * 4),
        lue: true,
      }),
    ],
  };
  routerApi();
});

describe('Écran Notifications : fil façon Facebook', () => {
  it('« À traiter » en haut, puis les groupes Nouveau / Aujourd’hui / Plus tôt avec heure relative', async () => {
    rendre();
    expect(screen.getByText('À traiter')).toBeTruthy();
    expect(screen.getByText('Section à traiter')).toBeTruthy();
    expect(await screen.findByText('Nouveau')).toBeTruthy();
    // « Aujourd'hui » : lue il y a 1 min, si l'on n'est pas à minuit pile.
    if (new Date(Date.now() - 60_000).getDate() === new Date().getDate()) {
      expect(screen.getByText('Aujourd’hui')).toBeTruthy();
      expect(screen.getByText('il y a 1 min')).toBeTruthy();
    }
    expect(screen.getByText('Plus tôt')).toBeTruthy();
    expect(screen.getByText('il y a 5 min')).toBeTruthy();
    // Noms et références en gras (segments distincts).
    expect(screen.getByText('Ali KONÉ')).toBeTruthy();
    expect(screen.getByText('TRF-3')).toBeTruthy();
    expect(screen.getByText('BRASSERIE DU SUD')).toBeTruthy();
  });

  it('non lue : pastille ; lue : sans pastille', async () => {
    rendre();
    expect(await screen.findByTestId('non-lue-n1')).toBeTruthy();
    expect(screen.queryByTestId('non-lue-n2')).toBeNull();
    expect(screen.getByLabelText(/Bon de transfert à valider\..*, non lue$/)).toBeTruthy();
  });

  it('un appui marque la notification lue et ouvre l’écran cible (retour aux Notifications)', async () => {
    rendre();
    fireEvent.press(await screen.findByTestId('notification-n1'));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/notification/n1/lue'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/stock/transferts', { depuis: 'notifications' });
    await waitFor(() => expect(screen.queryByTestId('non-lue-n1')).toBeNull());
  });

  it('notification déjà lue : pas de nouvel appel, navigation vers la fiche commande', async () => {
    rendre();
    fireEvent.press(await screen.findByTestId('notification-n3'));
    expect(put).not.toHaveBeenCalled();
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/c1', { depuis: 'notifications' });
  });

  it('cible sans écran mobile : marquée lue, aucune navigation', async () => {
    pages.debut = [notif({ id: 'x', cible: { type: 'RELATION', id: 'i', route: 'fournisseur.invitations' } })];
    rendre();
    fireEvent.press(await screen.findByTestId('notification-x'));
    await waitFor(() => expect(put).toHaveBeenCalledWith('/notification/x/lue'));
    expect(ouvrir).not.toHaveBeenCalled();
  });

  it('responsable : une cible hors de son espace n’est pas ouverte', async () => {
    mockUser = { ...mockUser, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    pages.debut = [
      notif({ id: 'c', cible: { type: 'CLIENTS', id: null, route: 'clients' } }),
      notif({ id: 't', cible: { type: 'TRANSFERT', id: 't', route: 'transferts' } }),
    ];
    rendre();
    fireEvent.press(await screen.findByTestId('notification-c'));
    expect(ouvrir).not.toHaveBeenCalled();
    fireEvent.press(screen.getByTestId('notification-t'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/stock/transferts', { depuis: 'notifications-responsable' });
  });

  it('« Tout marquer comme lu » : un seul envoi, toutes les pastilles disparaissent', async () => {
    pages.debut = [notif({ id: 'a' }), notif({ id: 'b' })];
    nonLues = 2;
    rendre();
    const bouton = await screen.findByText('Tout marquer comme lu');
    fireEvent.press(bouton);
    fireEvent.press(bouton);
    await waitFor(() => expect(put).toHaveBeenCalledWith('/notification/me/toutes-lues'));
    expect(put).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('non-lue-a')).toBeNull());
    expect(screen.queryByTestId('non-lue-b')).toBeNull();
    expect(screen.queryByText('Nouveau')).toBeNull();
  });

  it('défilement : la page suivante est demandée avec l’id de la dernière reçue', async () => {
    const premiere = Array.from({ length: 20 }, (_, i) => notif({ id: `p${i}`, lue: true, creeLe: ilYA(60 * 24 * 3 + i) }));
    pages = { debut: premiere, p19: [notif({ id: 'suite', lue: true, texte: 'Notification de la page 2.', creeLe: ilYA(60 * 24 * 5) })] };
    const { UNSAFE_getByType } = rendre();
    await screen.findByTestId('notification-p0');
    const { FlatList } = jest.requireActual('react-native');
    await act(async () => {
      UNSAFE_getByType(FlatList).props.onEndReached();
    });
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/notification/me', { params: { avant: 'p19', taille: 20 } }),
    );
    // Page incomplète : plus de demande.
    get.mockClear();
    await act(async () => {
      UNSAFE_getByType(FlatList).props.onEndReached();
    });
    expect(get).not.toHaveBeenCalledWith('/notification/me', expect.objectContaining({ params: expect.objectContaining({ avant: 'suite' }) }));
  });

  it('état vide illustré, distinct de l’état d’erreur', async () => {
    pages.debut = [];
    nonLues = 0;
    const { unmount } = rendre();
    expect(await screen.findByText('Aucune notification')).toBeTruthy();
    expect(screen.queryByText('Tout marquer comme lu')).toBeNull();
    unmount();
    echecFil = true;
    rendre();
    expect(await screen.findByText('Notifications indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucune notification')).toBeNull();
    // La section « À traiter » reste affichée.
    expect(screen.getByText('Section à traiter')).toBeTruthy();
  });

  it('le spinner du tirer-pour-rafraîchir ne suit pas la relecture de fond', async () => {
    const { UNSAFE_getByType } = rendre();
    await screen.findByTestId('notification-n1');
    const { RefreshControl, FlatList } = jest.requireActual('react-native');
    const qc = clients[clients.length - 1];
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
    // Relecture de fond (intervalle de 30 s) : pas de spinner.
    let fin: () => void = () => {};
    get.mockImplementationOnce(() => new Promise((r) => { fin = () => r({ data: [] }); }));
    act(() => {
      void qc.refetchQueries({ queryKey: ['notifications', 'fil'] });
    });
    expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false);
    await act(async () => fin());
    // Geste de l'utilisateur : spinner jusqu'à la fin de la lecture.
    await act(async () => {
      UNSAFE_getByType(FlatList).props.refreshControl.props.onRefresh();
    });
    await waitFor(() => expect(UNSAFE_getByType(RefreshControl).props.refreshing).toBe(false));
  });

  it('retour sur l’écran : fil, compteur et « À traiter » relus', async () => {
    rendre();
    await screen.findByTestId('notification-n1');
    get.mockClear();
    await act(async () => {
      mockFocus[mockFocus.length - 1]();
    });
    expect(rafraichir).toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('/notification/me', expect.anything());
    expect(get).toHaveBeenCalledWith('/notification/me/non-lues/compte');
  });
});
