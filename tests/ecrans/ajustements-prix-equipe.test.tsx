import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MesPrixPage from '../../app/(livreur)/profil/prix';
import PrixClientPage from '../../app/(livreur)/clients/[id]/prix';
import ReaffecterClients from '../../app/(livreur)/profil/apprentis/reaffecter';
import HistoriqueReaffectations from '../../app/(livreur)/profil/apprentis/reaffectations';
import ApprentisList from '../../app/(livreur)/profil/apprentis/index';
import ClientsList from '../../app/(livreur)/clients/index';
import { ProduitPicker, type Ligne } from '../../components/livreur/ProduitPicker';
import { dialog } from '../../lib/dialog';
import { naviguer, ouvrir } from '../../lib/navigation-app';
import { indexPrixAchat } from '../../features/prix/plancher';
import { useMesPrixAchat } from '../../features/prix/hooks';
import { useReaffectations } from '../../features/equipe/hooks';
import type { PrixAchatProduitResponse } from '../../types/api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => ({ id: 'c1' }),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
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
const PRINCIPAL = { id: 'r1', prenom: 'Jean', nom: 'Racine', parentId: null };
let mockUser: Record<string, unknown> = PRINCIPAL;
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('../../features/produits/hooks', () => ({
  useProduits: () => ({
    data: [
      { id: 'p1', code: 'PROD-1', designation: 'Baguette' },
      { id: 'p2', code: 'PROD-2', designation: 'Croissant' },
      { id: 'p3', code: 'PROD-3', designation: 'Pain' },
    ],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  }),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: () => ({ data: [] }),
}));
jest.mock('../../features/organisation/hooks', () => ({
  useGrillePrix: () => ({ data: undefined, isLoading: false, isError: false }),
}));
const mockUpsertPrix = { mutate: jest.fn(), isPending: false };
const mockUpsertPrixClient = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/prix/hooks', () => ({
  useMesPrix: () => ({
    data: [{ produit: { id: 'p3' }, prix: 1450 }],
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
  usePrixClient: () => ({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() }),
  useUpsertPrixLivreur: () => mockUpsertPrix,
  useSupprimerPrixLivreur: () => ({ mutate: jest.fn(), isPending: false }),
  useUpsertPrixClient: () => mockUpsertPrixClient,
  useSupprimerPrixClient: () => ({ mutate: jest.fn(), isPending: false }),
  useResoudrePrix: () => ({ data: undefined, isError: false, isFetching: false, refetch: jest.fn() }),
  useMesPrixAchat: jest.fn(),
}));
const CLIENTS = [
  {
    id: 'c1',
    prenom: 'Awa',
    nom: 'Traoré',
    quartier: { libelle: 'Cocody' },
    livreur: { id: 'r1', prenom: 'Jean', nom: 'Racine' },
  },
  {
    id: 'c2',
    prenom: 'Bakary',
    nom: 'Koné',
    quartier: { libelle: 'Yopougon' },
    livreur: { id: 'a1', prenom: 'Moussa', nom: 'Diallo' },
  },
];
jest.mock('../../features/clients/hooks', () => ({
  useClientsByLivreur: () => ({ data: CLIENTS, isLoading: false, isFetching: false, refetch: jest.fn() }),
  useClientsEquipe: () => ({ data: CLIENTS, isLoading: false, isFetching: false, isError: false, refetch: jest.fn() }),
  useEncoursByLivreur: () => ({ data: [], isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({
    data: [
      { id: 'a1', prenom: 'Moussa', nom: 'Diallo', username: 'moussa', actif: true },
      { id: 'a2', prenom: 'Ibrahim', nom: 'Sow', username: 'ibra', actif: false },
    ],
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
  useToggleApprentiActif: () => ({ mutate: jest.fn(), isPending: false }),
  useResetMotDePasse: () => ({ mutate: jest.fn(), isPending: false }),
  useDemandesReinitialisation: () => ({ data: [], isLoading: false, isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/lookups/hooks', () => ({
  useZones: () => ({ data: [{ id: 'z2', libelle: 'Nord' }, { id: 'z1', libelle: 'Abidjan Sud' }], isLoading: false }),
}));
const mockReaffecter = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/equipe/hooks', () => ({
  useReaffecterClients: () => mockReaffecter,
  useReaffectations: jest.fn(),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const achat = (produitId: string, designation: string, detail: Array<[string, number]>): PrixAchatProduitResponse => ({
  produitId,
  designation,
  prixAchat: detail[0][1],
  fournisseur: { id: `f-${detail[0][0]}`, libelle: detail[0][0] },
  detail: detail.map(([libelle, prixAchat]) => ({ fournisseurId: `f-${libelle}`, libelle, prixAchat })),
});
const prixAchat = useMesPrixAchat as jest.Mock;
const ACHATS = indexPrixAchat([
  achat('p3', 'Pain', [
    ['Moulin A', 1500],
    ['Moulin B', 1550],
  ]),
  achat('p1', 'Baguette', [['Moulin A', 200]]),
]);
const reaffectations = useReaffectations as jest.Mock;

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = PRINCIPAL;
  prixAchat.mockReturnValue({ data: ACHATS, isSuccess: true, isError: false, refetch: jest.fn() });
  reaffectations.mockReturnValue({ data: [], isLoading: false, isFetching: false, isError: false, refetch: jest.fn() });
});

describe('Nouvelle livraison : produit ajouté en tête (P4)', () => {
  it('le produit ajouté s’insère en tête, les lignes saisies gardent leur ordre', () => {
    const onChange = jest.fn();
    const lignes: Ligne[] = [
      { produitId: 'p3', designation: 'Pain', prix: 100, qte: 1 },
      { produitId: 'p1', designation: 'Baguette', prix: 100, qte: 2 },
    ];
    wrap(<ProduitPicker lignes={lignes} onChange={onChange} />);
    fireEvent.press(screen.getByText('Croissant'));
    expect(onChange).toHaveBeenCalledWith([
      { produitId: 'p2', designation: 'Croissant', prix: 0, qte: 1 },
      ...lignes,
    ]);
  });

  it('alerte P5 sur la ligne sous son prix d’achat', () => {
    wrap(
      <ProduitPicker
        lignes={[{ produitId: 'p3', designation: 'Pain', prix: 1450, qte: 1 }]}
        onChange={jest.fn()}
        prixAchat={ACHATS}
      />,
    );
    expect(screen.getByText("Le prix de vente de Pain (1 450 F) est inférieur au prix d'achat (1 500 F).")).toBeTruthy();
  });
});

describe('Mes prix de vente : prix d’achat et plancher (P2, P5)', () => {
  it('prix d’achat le plus bas, fournisseur et détail ; produit sans fournisseur signalé', () => {
    wrap(<MesPrixPage />);
    expect(prixAchat).toHaveBeenCalledWith(true);
    expect(screen.getByLabelText("Prix d'achat : 1 500 F chez Moulin A")).toBeTruthy();
    expect(screen.getByText('Moulin B')).toBeTruthy();
    expect(screen.getByText('1 550 F')).toBeTruthy();
    expect(screen.getByText("Prix d'achat : aucun fournisseur ne le propose")).toBeTruthy();
  });

  it('prix enregistré sous le prix d’achat : alerte P5', () => {
    wrap(<MesPrixPage />);
    expect(screen.getByText("Le prix de vente de Pain (1 450 F) est inférieur au prix d'achat (1 500 F).")).toBeTruthy();
  });

  it('saisie sous le prix d’achat : refusée avant l’envoi, avec le message du back', () => {
    wrap(<MesPrixPage />);
    const champs = screen.getAllByPlaceholderText('0');
    // Baguette (premier produit sans prix) : achat 200 F.
    fireEvent.changeText(champs[0], '150');
    expect(screen.getByText("Le prix de vente de Baguette (150 F) est inférieur au prix d'achat (200 F).")).toBeTruthy();
    fireEvent.press(screen.getAllByText('Enregistrer')[0]);
    expect(mockUpsertPrix.mutate).not.toHaveBeenCalled();
    expect(dialog.error).toHaveBeenCalledWith(
      'Prix refusé',
      "Le prix de vente de Baguette (150 F) est inférieur au prix d'achat (200 F).",
    );
    fireEvent.changeText(champs[0], '200');
    fireEvent.press(screen.getAllByText('Enregistrer')[0]);
    expect(mockUpsertPrix.mutate).toHaveBeenCalledTimes(1);
    expect(mockUpsertPrix.mutate.mock.calls[0][0]).toEqual({ produitId: 'p1', prix: 200 });
  });

  it('refus du back affiché tel quel', () => {
    wrap(<MesPrixPage />);
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[1], '900');
    fireEvent.press(screen.getAllByText('Enregistrer')[1]);
    const options = mockUpsertPrix.mutate.mock.calls[0][1];
    act(() => {
      options.onError({ isAxiosError: true, response: { status: 400, data: { message: 'Message du back.' } } });
      options.onSettled();
    });
    expect(dialog.error).toHaveBeenCalledWith('Erreur', 'Message du back.');
  });

  it('membre d’organisation : ni prix d’achat lu ni alerte', () => {
    mockUser = { id: 'k1', prenom: 'Ali', nom: 'K', parentId: 'r9', organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    wrap(<MesPrixPage />);
    expect(prixAchat).toHaveBeenCalledWith(false);
    expect(screen.queryByText(/Prix d'achat/)).toBeNull();
    expect(screen.queryByText(/est inférieur au prix d'achat/)).toBeNull();
  });
});

describe('Prix client : plancher (P5)', () => {
  it('prix client sous le prix d’achat refusé avant l’envoi', () => {
    wrap(<PrixClientPage />);
    expect(screen.getByText("Prix d'achat : 1 500 F · Moulin A")).toBeTruthy();
    // Pain (troisième produit) : achat 1 500 F.
    const champs = screen.getAllByPlaceholderText(/^(0|Hérite de .*)$/);
    fireEvent.changeText(champs[2], '1400');
    fireEvent.press(screen.getAllByText('Enregistrer')[2]);
    expect(mockUpsertPrixClient.mutate).not.toHaveBeenCalled();
    expect(dialog.error).toHaveBeenCalledWith(
      'Prix refusé',
      "Le prix de vente de Pain (1 400 F) est inférieur au prix d'achat (1 500 F).",
    );
  });
});

describe('Réaffectation des clients par le livreur principal (P8)', () => {
  const choisirCible = (label: string) => {
    fireEvent.press(screen.getByText('Choisir l’apprenti'));
    fireEvent.press(screen.getByText(label));
  };

  it('sélection : clients de l’équipe, apprenti actif, demande envoyée', () => {
    wrap(<ReaffecterClients />);
    // Livreur actuel affiché ; apprenti désactivé absent des cibles.
    expect(screen.getByText('Cocody · Moi')).toBeTruthy();
    expect(screen.getByText('Yopougon · Moussa Diallo')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Awa Traoré'));
    fireEvent.press(screen.getByText('Choisir l’apprenti'));
    expect(screen.queryByText('Ibrahim Sow')).toBeNull();
    fireEvent.press(screen.getByText('Moussa Diallo'));
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    expect(mockReaffecter.mutate).toHaveBeenCalledTimes(1);
    const [demande, options] = mockReaffecter.mutate.mock.calls[0];
    expect(demande).toEqual({ clientIds: ['c1'], livreurId: 'a1' });
    act(() => {
      options.onSuccess({ reaffectes: 1, clientIds: ['c1'] });
      options.onSettled();
    });
    expect(dialog.success).toHaveBeenCalledWith('Réaffectation enregistrée', '1 client réaffecté.');
  });

  it('reprise par le principal lui-même, par zone', () => {
    wrap(<ReaffecterClients />);
    fireEvent.press(screen.getByLabelText('Par zone'));
    fireEvent.press(screen.getByText('Choisir une zone'));
    fireEvent.press(screen.getByText('Nord'));
    choisirCible('Moi (Jean Racine)');
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    expect(mockReaffecter.mutate.mock.calls[0][0]).toEqual({ zoneId: 'z2', livreurId: 'r1' });
  });

  it('ni client ni zone : message du back, rien n’est envoyé ; refus du back affiché tel quel', () => {
    wrap(<ReaffecterClients />);
    choisirCible('Moussa Diallo');
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    expect(mockReaffecter.mutate).not.toHaveBeenCalled();
    expect(screen.getByText('Choisissez des clients ou une zone.')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Bakary Koné'));
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    const options = mockReaffecter.mutate.mock.calls[0][1];
    act(() => {
      options.onError({
        isAxiosError: true,
        response: { status: 400, data: { message: 'Cet apprenti est désactivé : choisissez un apprenti actif.' } },
      });
      options.onSettled();
    });
    expect(screen.getByText('Cet apprenti est désactivé : choisissez un apprenti actif.')).toBeTruthy();
  });

  it('double appui : une seule demande', () => {
    wrap(<ReaffecterClients />);
    fireEvent.press(screen.getByLabelText('Awa Traoré'));
    choisirCible('Moussa Diallo');
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    fireEvent.press(screen.getByLabelText('Réaffecter'));
    expect(mockReaffecter.mutate).toHaveBeenCalledTimes(1);
  });

  it('apprenti ou membre d’organisation : écran réservé, aucun envoi possible', () => {
    mockUser = { id: 'a1', prenom: 'Moussa', nom: 'Diallo', parentId: 'r1' };
    wrap(<ReaffecterClients />);
    expect(screen.getByText('Réservé au livreur principal')).toBeTruthy();
    screen.unmount();
    mockUser = { id: 'k1', prenom: 'Ali', nom: 'K', parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' };
    wrap(<ReaffecterClients />);
    expect(screen.getByText('Réservé au livreur principal')).toBeTruthy();
    expect(mockReaffecter.mutate).not.toHaveBeenCalled();
  });

  it('historique : 30 j par défaut, déplacements affichés', () => {
    reaffectations.mockReturnValue({
      data: [
        {
          id: 'h1',
          date: '2026-10-13T09:30:00',
          clientId: 'c1',
          clientNom: 'Traoré',
          clientPrenom: 'Awa',
          ancienCommercialId: 'r1',
          ancienCommercialNom: 'Racine',
          ancienCommercialPrenom: 'Jean',
          nouveauCommercialId: 'a1',
          nouveauCommercialNom: 'Diallo',
          nouveauCommercialPrenom: 'Moussa',
          parId: 'r1',
          parNom: 'Racine',
          parPrenom: 'Jean',
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });
    wrap(<HistoriqueReaffectations />);
    expect(screen.getByLabelText('30 j').props.accessibilityState).toEqual({ selected: true });
    const bornes = reaffectations.mock.calls[0][0];
    expect(bornes.debut).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(bornes.fin).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(screen.getByText('Awa Traoré')).toBeTruthy();
    expect(screen.getByText('Moi')).toBeTruthy();
    expect(screen.getByText('Moussa Diallo')).toBeTruthy();
    expect(screen.getByText('Par Moi')).toBeTruthy();
  });

  it('historique en échec : état d’erreur distinct de l’état vide', () => {
    reaffectations.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: true, error: new Error('x'), refetch: jest.fn() });
    wrap(<HistoriqueReaffectations />);
    expect(screen.getByText('Chargement impossible')).toBeTruthy();
    expect(screen.queryByText('Aucune réaffectation')).toBeNull();
  });

  it('entrées : « Mes apprentis » et « Mes clients » pour le principal seulement', () => {
    wrap(<ApprentisList />);
    fireEvent.press(screen.getByLabelText('Réaffecter des clients'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/profil/apprentis/reaffecter');
    screen.unmount();
    wrap(<ClientsList />);
    fireEvent.press(screen.getByLabelText('Réaffecter des clients'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/profil/apprentis/reaffecter', { depuis: 'clients' });
  });

  it('entrées absentes pour un apprenti', () => {
    mockUser = { id: 'a1', prenom: 'Moussa', nom: 'Diallo', parentId: 'r1' };
    wrap(<ClientsList />);
    expect(screen.queryByLabelText('Réaffecter des clients')).toBeNull();
  });
});
