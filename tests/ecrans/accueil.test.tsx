import { fireEvent, render, screen } from '@testing-library/react-native';
import { ouvrir } from '../../lib/navigation-app';
import Tournee from '../../app/(livreur)/index';
import { useMouvementsStock } from '../../features/stock/hooks';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import type { MouvementStockResponse, TypeMouvementStock } from '../../types/api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/',
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
let mockUser: Record<string, unknown> = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null, statut: 'ACTIF' };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
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
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsByLivreur: jest.fn() }));
jest.mock('../../features/encaissements/hooks', () => ({
  useEncaissementsByLivreur: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/clients/hooks', () => ({
  useEncoursByLivreur: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: () => ({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() }),
  useMouvementsStock: jest.fn(),
}));
let mockNbCommandes = 0;
jest.mock('../../features/commandes/hooks', () => ({
  useCommandesAReceptionner: () => ({ data: Array.from({ length: mockNbCommandes }), refetch: jest.fn() }),
}));
let mockRemises: unknown[] = [];
jest.mock('../../features/remises-argent/hooks', () => ({
  useRemisesAConfirmer: () => ({ data: mockRemises, isLoading: false, isError: false, refetch: jest.fn() }),
}));
let mockTransferts: unknown[] = [];
jest.mock('../../features/transferts/hooks', () => ({
  useTransfertsADecider: () => ({ data: mockTransferts, isLoading: false, isError: false, refetch: jest.fn() }),
}));
let mockEchues: unknown[] = [];
jest.mock('../../features/previsions/hooks', () => ({
  usePrevisionsEchues: () => ({ echues: mockEchues, isLoading: false, isError: false, refetch: jest.fn() }),
}));

let mockNonLues = 0;
jest.mock('../../features/notifications/hooks', () => ({
  useNombreNonLues: () => ({ data: mockNonLues, isLoading: false, isError: false, refetch: jest.fn() }),
  useRelireAuFocus: jest.fn(),
}));
let mockDemandes: unknown[] = [];
// M1 : demandes « Mot de passe oublié » (aucune par défaut).
jest.mock('../../features/apprentis/hooks', () => ({
  useDemandesReinitialisation: jest.fn(() => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() })),
}));
jest.mock('../../features/demandes-modif/hooks', () => ({
  useDemandesModif: (enabled: boolean) => ({ data: enabled ? mockDemandes : undefined, isLoading: false, isError: false, refetch: jest.fn() }),
}));

let mockAbonnement: unknown = { statut: 'ESSAI', formule: 'LIVREUR', herite: false };
jest.mock('../../components/localisation/BandeauDemandesRecues', () => ({ BandeauDemandesRecues: () => null }));
jest.mock('../../features/abonnement/hooks', () => ({
  useMonAbonnement: () => ({ data: mockAbonnement, isLoading: false, isError: false, refetch: jest.fn() }),
}));

const mouvements = useMouvementsStock as jest.Mock;
const livraisons = useLivraisonsByLivreur as jest.Mock;

const aujourdhui = (() => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T09:00:00`;
})();
const mv = (type: TypeMouvementStock, designation: string, quantite: number): MouvementStockResponse => ({
  date: aujourdhui,
  type,
  produit: { id: `id-${designation}`, code: designation, designation },
  quantite,
  reference: null,
  contrepartie: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null, statut: 'ACTIF' };
  livraisons.mockReturnValue(lecture([]));
  mouvements.mockReturnValue(lecture([]));
  mockNbCommandes = 0;
  mockEchues = [];
  mockAbonnement = { statut: 'ESSAI', formule: 'LIVREUR', herite: false };
  mockRemises = [];
  mockTransferts = [];
  mockNonLues = 0;
  mockDemandes = [];
});

describe('Accueil : cloche', () => {
  it('badge = notifications non lues ; la cloche ouvre l’écran Notifications', () => {
    mockNonLues = 4;
    mockNbCommandes = 2;
    mockEchues = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
    render(<Tournee />);
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.queryByTestId('cloche-a-traiter')).toBeNull();
    fireEvent.press(screen.getByLabelText('Notifications : 4 non lues, 5 à traiter'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/previsions/echues');
  });

  it('plus de 99 non lues : « 99+ »', () => {
    mockNonLues = 150;
    render(<Tournee />);
    expect(screen.getByText('99+')).toBeTruthy();
  });

  it('rien de non lu mais des actions à traiter : pastille sans chiffre', () => {
    mockNbCommandes = 2;
    mockEchues = [{ cle: 'a' }, { cle: 'b' }, { cle: 'c' }];
    render(<Tournee />);
    expect(screen.getByTestId('cloche-a-traiter')).toBeTruthy();
    expect(screen.queryByText('5')).toBeNull();
    expect(screen.getByLabelText('Notifications : 0 non lue, 5 à traiter')).toBeTruthy();
  });

  it('principal : + remises déclarées à confirmer', () => {
    mockNbCommandes = 1;
    mockRemises = [{ statut: 'DECLAREE' }, { statut: 'DECLAREE' }];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue, 3 à traiter')).toBeTruthy();
  });

  it('principal : + demandes de modification de versement à décider (pas les siennes)', () => {
    mockDemandes = [
      { statut: 'PENDING', demandeurType: 'FOURNISSEUR' },
      { statut: 'PENDING', demandeurType: 'LIVREUR' },
      { statut: 'APPROVED', demandeurType: 'FOURNISSEUR' },
    ];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue, 1 à traiter')).toBeTruthy();
  });

  it('apprenti : les remises et les demandes de modification ne comptent pas', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mockRemises = [{ statut: 'DECLAREE' }];
    mockDemandes = [{ statut: 'PENDING', demandeurType: 'FOURNISSEUR' }];
    mockNonLues = 1;
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 1 non lue')).toBeTruthy();
  });

  it('+ transferts à recevoir (dont je suis le décideur), principal comme apprenti', () => {
    mockNbCommandes = 1;
    mockTransferts = [
      { statut: 'EN_ATTENTE', decideurId: mockUser.id },
      { statut: 'EN_ATTENTE', decideurId: 'autre' },
    ];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue, 2 à traiter')).toBeTruthy();
  });

  it('apprenti : transferts à recevoir comptés', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mockTransferts = [{ statut: 'EN_ATTENTE', decideurId: mockUser.id }];
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue, 1 à traiter')).toBeTruthy();
  });

  it('sans rien à traiter ni non lu : ni badge ni pastille', () => {
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue')).toBeTruthy();
    expect(screen.queryByTestId('cloche-a-traiter')).toBeNull();
  });
});

describe('Accueil : chiffres cliquables de la carte verte', () => {
  it('affiche Livraisons, Produits vendus et Réceptionnés, sans les blocs détaillés', () => {
    mouvements.mockReturnValue(
      lecture([
        mv('LIVRAISON', 'Pain', -5),
        mv('LIVRAISON', 'Lait', -3),
        mv('RETOUR_EN_STOCK', 'Pain', 1),
        mv('RECEPTION', 'Pain', 20),
        mv('TRANSFERT_ENTREE', 'Lait', 6),
      ]),
    );
    render(<Tournee />);
    expect(screen.getByLabelText('Livraisons : 0')).toBeTruthy();
    // Nombre de produits différents : Pain et Lait vendus → 2 ; seul Pain réceptionné (transfert exclu) → 1.
    expect(screen.getByLabelText('Produits vendus : 2')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : 1')).toBeTruthy();
    // Les anciens blocs « Produits vendus · aujourd'hui » et « Réceptions » ont disparu.
    expect(screen.queryByText(/Produits vendus · aujourd/)).toBeNull();
    expect(screen.queryByText(/Réceptions · aujourd/)).toBeNull();
    expect(screen.queryByText('Pain')).toBeNull();
  });

  it('chaque chiffre ouvre sa page', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Livraisons : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons');
    fireEvent.press(screen.getByLabelText('Produits vendus : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons/produits-vendus');
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/commandes');
  });

  it('tuile « À encaisser » → Encours ; actions rapides sur une pile propre', () => {
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('À encaisser'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/encours');
    fireEvent.press(screen.getByText('Encaisser'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/livraisons');
    fireEvent.press(screen.getByText('Retour produit'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/retour-client');
  });

  it('commercial d’organisation : Réceptionnés ouvre les transferts, aucune commande comptée', () => {
    mockUser = { ...mockUser, parentId: 'r1', organisationId: 'o1', organisationRole: 'COMMERCIAL' };
    mockNbCommandes = 2;
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    expect(screen.getByLabelText('Notifications : 0 non lue')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/stock/transferts');
  });

  it('apprenti : Réceptionnés ouvre les commandes à réceptionner', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    mouvements.mockReturnValue(lecture([]));
    render(<Tournee />);
    fireEvent.press(screen.getByLabelText('Réceptionnés : 0'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });

  it('chargement : « … » ; erreur : « — »', () => {
    mouvements.mockReturnValue(lecture(undefined, { isLoading: true }));
    livraisons.mockReturnValue(lecture(undefined, { isError: true }));
    const { unmount } = render(<Tournee />);
    expect(screen.getByLabelText('Produits vendus : …')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : …')).toBeTruthy();
    expect(screen.getByLabelText('Livraisons : —')).toBeTruthy();
    unmount();

    mouvements.mockReturnValue(lecture(undefined, { isError: true }));
    render(<Tournee />);
    expect(screen.getByLabelText('Produits vendus : —')).toBeTruthy();
    expect(screen.getByLabelText('Réceptionnés : —')).toBeTruthy();
  });
});

describe('Accueil : bandeau abonnement expiré', () => {
  it('EXPIRE : bandeau « Abonnement expiré : consultation seule. »', () => {
    mockAbonnement = { statut: 'EXPIRE', formule: 'LIVREUR', herite: false };
    render(<Tournee />);
    expect(screen.getByText('Abonnement expiré : consultation seule.')).toBeTruthy();
  });

  it.each([
    ['ESSAI', { statut: 'ESSAI', formule: 'LIVREUR', herite: false }],
    ['ACTIF', { statut: 'ACTIF', formule: 'LIVREUR', herite: false }],
    ['sans abonnement', null],
  ])('%s : pas de bandeau', (_nom, abo) => {
    mockAbonnement = abo;
    render(<Tournee />);
    expect(screen.queryByText('Abonnement expiré : consultation seule.')).toBeNull();
  });

  it('plus d’écran « Compte en attente de validation »', () => {
    mockUser = { ...mockUser, statut: 'EN_ATTENTE_VALIDATION' };
    render(<Tournee />);
    expect(screen.queryByText('Compte en attente de validation')).toBeNull();
    expect(screen.getByLabelText('Notifications : 0 non lue')).toBeTruthy();
  });
});
