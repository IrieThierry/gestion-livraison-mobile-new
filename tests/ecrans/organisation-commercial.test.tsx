import { act, fireEvent, render, screen } from '@testing-library/react-native';
import DemandesChargement from '../../app/(livreur)/stock/demandes/index';
import NouvelleDemandeChargement from '../../app/(livreur)/stock/demandes/nouvelle';
import MesFactures from '../../app/(livreur)/profil/factures';
import StockCourant from '../../app/(livreur)/stock/index';
import TransfertsList from '../../app/(livreur)/stock/transferts/index';
import MesPrixPage from '../../app/(livreur)/profil/prix';
import { dialog } from '../../lib/dialog';
import { naviguer, revenirApresEnregistrement } from '../../lib/navigation-app';
import * as orgHooks from '../../features/organisation/hooks';
import { facture, avoir } from '../../features/organisation/documents.fixture';
import type { DemandeChargementResponse } from '../../types/api';

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
  revenirApresEnregistrement: jest.fn(),
  origineDe: jest.fn(() => null),
}));
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
const COMMERCIAL = { id: 'k1', prenom: 'Ali', nom: 'Kone', parentId: 'r1', organisationId: 'o1', organisationRole: 'COMMERCIAL' };
let mockUser: Record<string, unknown> = COMMERCIAL;
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('../../features/organisation/hooks', () => ({
  useMesDemandesChargement: jest.fn(),
  useAnnulerDemandeChargement: jest.fn(),
  useCreerDemandeChargement: jest.fn(),
  useMesFactures: jest.fn(),
  useMesAvoirs: jest.fn(),
  useGrillePrix: jest.fn(),
}));
const mockPartage = { enCours: null, facture: jest.fn(), factureDeLivraison: jest.fn(), avoir: jest.fn() };
jest.mock('../../features/organisation/usePartageDocuments', () => ({
  usePartageDocuments: () => mockPartage,
  apresFermetureDialogue: (f: () => void) => f(),
}));
jest.mock('../../features/produits/hooks', () => ({
  useProduits: () => ({
    data: [
      { id: 'p1', code: 'PROD-1', designation: 'Coca 33cl' },
      { id: 'p2', code: 'PROD-2', designation: 'Fanta' },
    ],
    isLoading: false,
    isError: false,
  }),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: () => ({ data: [], isFetching: false, isLoading: false, refetch: jest.fn() }),
  useStockEnTransit: () => ({ data: { lignes: [] } }),
  useMettreAZeroStock: () => ({ mutate: jest.fn(), isPending: false }),
}));
let mockTransfertsLivreur: unknown[] = [];
jest.mock('../../features/transferts/hooks', () => ({
  useTransfertsParent: () => ({ data: [], isLoading: false, isFetching: false, refetch: jest.fn() }),
  useTransfertsLivreur: () => ({ data: mockTransfertsLivreur, isLoading: false, isFetching: false, refetch: jest.fn() }),
  useAccepterTransfert: () => ({ mutate: jest.fn(), isPending: false }),
  useRefuserTransfert: () => ({ mutate: jest.fn(), isPending: false }),
  useAnnulerTransfert: () => ({ mutate: jest.fn(), isPending: false }),
}));
const mockUpsertPrix = { mutate: jest.fn(), isPending: false };
const mockSupprimerPrix = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/prix/hooks', () => ({
  useMesPrix: () => ({
    data: [{ produit: { id: 'p1' }, prix: 500 }],
    isLoading: false,
    isFetching: false,
    refetch: jest.fn(),
  }),
  useUpsertPrixLivreur: () => mockUpsertPrix,
  useSupprimerPrixLivreur: () => mockSupprimerPrix,
  // P2 : aucun prix d'achat connu (pas d'alerte).
  useMesPrixAchat: () => ({ data: new Map(), isSuccess: true, isError: false, refetch: jest.fn() }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const h = orgHooks as unknown as Record<string, jest.Mock>;
const lecture = (data: unknown, autres: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...autres,
});
const mutation = () => ({ mutate: jest.fn(), isPending: false, variables: undefined });

const demande = (over: Partial<DemandeChargementResponse>): DemandeChargementResponse => ({
  id: 'd1',
  reference: 'DCH-1',
  date: '2026-10-13T09:30:00',
  statut: 'EN_ATTENTE',
  commercialId: 'k1',
  commercialNom: 'Kone',
  commercialPrenom: 'Ali',
  motifRefus: null,
  dateTraitement: null,
  traiteParId: null,
  quantiteTotaleDemandee: 14,
  quantiteTotaleServie: null,
  lignes: [
    { produitId: 'p1', code: 'PROD-1', designation: 'Coca 33cl', quantiteDemandee: 10, quantiteServie: null, transfertId: null, statutTransfert: null },
    { produitId: 'p2', code: 'PROD-2', designation: 'Fanta', quantiteDemandee: 4, quantiteServie: null, transfertId: null, statutTransfert: null },
  ],
  ...over,
});

let annuler: ReturnType<typeof mutation>;
let creer: ReturnType<typeof mutation>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = COMMERCIAL;
  mockTransfertsLivreur = [];
  annuler = mutation();
  creer = mutation();
  h.useAnnulerDemandeChargement.mockReturnValue(annuler);
  h.useCreerDemandeChargement.mockReturnValue(creer);
  h.useMesDemandesChargement.mockReturnValue(lecture([]));
  h.useMesFactures.mockReturnValue(lecture([facture]));
  h.useMesAvoirs.mockReturnValue(lecture([avoir]));
});

describe('Demandes de chargement (O8)', () => {
  it('liste : statuts, quantités servies, transfert à accepter, motif de refus', () => {
    h.useMesDemandesChargement.mockReturnValue(
      lecture([
        demande({}),
        demande({
          id: 'd2',
          reference: 'DCH-2',
          statut: 'SERVIE',
          quantiteTotaleServie: 12,
          lignes: [
            { produitId: 'p1', code: 'PROD-1', designation: 'Coca 33cl', quantiteDemandee: 10, quantiteServie: 12, transfertId: 't1', statutTransfert: 'EN_ATTENTE' },
          ],
        }),
        demande({ id: 'd3', reference: 'DCH-3', statut: 'REFUSEE', motifRefus: 'Dépôt vide' }),
      ]),
    );
    render(<DemandesChargement />);
    // Statut de la demande DCH-1 et du transfert de DCH-2.
    expect(screen.getAllByText('En attente')).toHaveLength(2);
    expect(screen.getByText('Servie')).toBeTruthy();
    expect(screen.getByText('Refusée')).toBeTruthy();
    expect(screen.getByText('12 / 10')).toBeTruthy();
    expect(screen.getByText('Accepte le chargement dans Transferts pour l’avoir dans ton stock.')).toBeTruthy();
    expect(screen.getByText('Motif : Dépôt vide')).toBeTruthy();
    // Seule la demande en attente s'annule.
    expect(screen.getByLabelText('Annuler la demande DCH-1')).toBeTruthy();
    expect(screen.queryByLabelText('Annuler la demande DCH-2')).toBeNull();
    expect(screen.queryByLabelText('Annuler la demande DCH-3')).toBeNull();
  });

  it('demande servie : un seul bon pour toutes les lignes, avec sa référence et son statut', () => {
    mockTransfertsLivreur = [{ id: 't7', reference: 'TRF-7' }];
    h.useMesDemandesChargement.mockReturnValue(
      lecture([
        demande({
          statut: 'SERVIE',
          quantiteTotaleServie: 8,
          lignes: [
            { produitId: 'p1', code: 'PROD-1', designation: 'Coca 33cl', quantiteDemandee: 10, quantiteServie: 5, transfertId: 't7', statutTransfert: 'ACCEPTE' },
            { produitId: 'p2', code: 'PROD-2', designation: 'Fanta', quantiteDemandee: 4, quantiteServie: 3, transfertId: 't7', statutTransfert: 'ACCEPTE' },
            { produitId: 'p3', code: 'PROD-3', designation: 'Sprite', quantiteDemandee: 2, quantiteServie: 0, transfertId: null, statutTransfert: null },
          ],
        }),
      ]),
    );
    const { unmount } = render(<DemandesChargement />);
    expect(screen.getByText('Transfert TRF-7')).toBeTruthy();
    expect(screen.getAllByText('Accepté')).toHaveLength(1);
    expect(screen.getByText('0 / 2')).toBeTruthy();
    expect(screen.queryByText('Accepte le chargement dans Transferts pour l’avoir dans ton stock.')).toBeNull();
    unmount();
    // Transferts pas encore lus : le bon s'affiche sans référence.
    mockTransfertsLivreur = [];
    render(<DemandesChargement />);
    expect(screen.getByText('Transfert')).toBeTruthy();
    expect(screen.getAllByText('Accepté')).toHaveLength(1);
  });

  it('annulation confirmée : POST annuler de la demande', () => {
    h.useMesDemandesChargement.mockReturnValue(lecture([demande({})]));
    render(<DemandesChargement />);
    fireEvent.press(screen.getByLabelText('Annuler la demande DCH-1'));
    const { onConfirm, title } = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(title).toBe('Annuler la demande DCH-1 ?');
    onConfirm();
    onConfirm(); // double appui : un seul envoi
    expect(annuler.mutate).toHaveBeenCalledTimes(1);
    expect(annuler.mutate.mock.calls[0][0]).toBe('d1');
  });

  it('erreur de lecture distincte de la liste vide', () => {
    h.useMesDemandesChargement.mockReturnValue(
      lecture(undefined, { isError: true, error: { response: { data: { message: 'Accès refusé : ressource inaccessible' } } } }),
    );
    const { unmount } = render(<DemandesChargement />);
    expect(screen.getByText('Demandes indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucune demande de chargement')).toBeNull();
    unmount();
    h.useMesDemandesChargement.mockReturnValue(lecture([]));
    render(<DemandesChargement />);
    expect(screen.getByText('Aucune demande de chargement')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Nouvelle demande'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/stock/demandes/nouvelle');
  });

  it('nouvelle demande : produits et quantités envoyés, retour à la liste', () => {
    render(<NouvelleDemandeChargement />);
    fireEvent.press(screen.getByLabelText('Ajouter Coca 33cl'));
    fireEvent.press(screen.getByLabelText('Ajouter Fanta'));
    fireEvent.changeText(screen.getByLabelText('Quantité Coca 33cl'), '10');
    fireEvent.changeText(screen.getByLabelText('Quantité Fanta'), '4');
    fireEvent.press(screen.getByText('Envoyer la demande (14)'));
    expect(creer.mutate).toHaveBeenCalledTimes(1);
    expect(creer.mutate.mock.calls[0][0]).toEqual({
      lignes: [
        { produitId: 'p1', quantite: 10 },
        { produitId: 'p2', quantite: 4 },
      ],
    });
    act(() => creer.mutate.mock.calls[0][1].onSuccess(demande({ reference: 'DCH-7' })));
    expect(revenirApresEnregistrement).toHaveBeenCalledWith('/(livreur)/stock/demandes', null);
    expect(dialog.success).toHaveBeenCalledWith('Demande DCH-7 envoyée', 'Ton responsable va la servir ou la refuser.');
  });

  it('nouvelle demande sans quantité : message, rien d’envoyé', () => {
    render(<NouvelleDemandeChargement />);
    fireEvent.press(screen.getByLabelText('Ajouter Coca 33cl'));
    fireEvent.changeText(screen.getByLabelText('Quantité Coca 33cl'), '0');
    fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(creer.mutate).not.toHaveBeenCalled();
  });
});

describe('Mes factures (O17)', () => {
  it('factures : numéro, client, reste dû, avoirs liés ; « Partager » la facture', () => {
    render(<MesFactures />);
    expect(screen.getByText('FAC-2026-000001')).toBeTruthy();
    expect(screen.getByText(/Awa Boutique Awa/)).toBeTruthy();
    expect(screen.getByText('Avoirs : AV-2026-000001')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Partager la facture FAC-2026-000001'));
    expect(mockPartage.facture).toHaveBeenCalledWith(facture);
  });

  it('avoirs : facture d’origine ; « Partager » l’avoir', () => {
    render(<MesFactures />);
    fireEvent.press(screen.getByText('Avoirs'));
    expect(screen.getByText('AV-2026-000001')).toBeTruthy();
    expect(screen.getByText(/facture FAC-2026-000001/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Partager l’avoir AV-2026-000001'));
    expect(mockPartage.avoir).toHaveBeenCalledWith('a1');
  });

  it('liste vide et erreur distinctes', () => {
    h.useMesFactures.mockReturnValue(lecture([]));
    const { unmount } = render(<MesFactures />);
    expect(screen.getByText('Aucune facture')).toBeTruthy();
    unmount();
    h.useMesFactures.mockReturnValue(lecture(undefined, { isError: true, error: new Error('Réseau') }));
    render(<MesFactures />);
    expect(screen.getByText('Factures indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucune facture')).toBeNull();
  });
});

describe('Stock du commercial', () => {
  it('« Demandes de chargement » et « Rendre au dépôt »', () => {
    render(<StockCourant />);
    fireEvent.press(screen.getByText('Demandes de chargement'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/stock/demandes');
    fireEvent.press(screen.getByText('Rendre au dépôt'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/stock/transferts/nouveau');
    fireEvent.press(screen.getByText('Mes bons de transfert'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/stock/transferts');
    expect(screen.getByText('Chargements reçus et retours au dépôt')).toBeTruthy();
  });

  it('transferts : « Mes bons de transfert » et bouton « Rendre au dépôt »', () => {
    render(<TransfertsList />);
    expect(screen.getByText('Mes bons de transfert')).toBeTruthy();
    expect(screen.getByText('Rendre au dépôt')).toBeTruthy();
  });

  it('apprenti hors organisation : libellés inchangés, pas de demandes', () => {
    mockUser = { id: 'a1', prenom: 'Awa', nom: 'K', parentId: 'l1' };
    render(<StockCourant />);
    expect(screen.getByText('Rendre du stock')).toBeTruthy();
    expect(screen.getByText('Transferts')).toBeTruthy();
    expect(screen.queryByText('Mes bons de transfert')).toBeNull();
    expect(screen.queryByText('Demandes de chargement')).toBeNull();
  });
});

describe('Mes prix de vente (O6)', () => {
  const grille = (etat: Record<string, unknown> = {}) =>
    (orgHooks.useGrillePrix as jest.Mock).mockReturnValue({
      data: [
        { produit: { id: 'g1', code: 'PROD-7', designation: 'Sprite org', photoUrl: null }, prix: 750 },
        { produit: { id: 'g2', code: 'PROD-8', designation: 'Eau org', photoUrl: null }, prix: null },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
      ...etat,
    });

  it('commercial : grille du responsable (GET /organisation/me/grille-prix) en lecture seule, aucune écriture possible', () => {
    grille();
    render(<MesPrixPage />);
    expect(screen.getAllByText(/Prix fixés par ton responsable/).length).toBeGreaterThan(0);
    // Produits et prix de la grille, pas les prix personnels du commercial.
    expect(screen.getByText('Sprite org')).toBeTruthy();
    expect(screen.getByText('750 FCFA')).toBeTruthy();
    expect(screen.queryByText('500 FCFA')).toBeNull();
    expect(screen.queryByText('Coca 33cl')).toBeNull();
    expect(screen.getByText('Aucun prix fixé')).toBeTruthy();
    expect(screen.queryByText('Enregistrer')).toBeNull();
    expect(screen.queryByText('Modifier le prix')).toBeNull();
    expect(screen.queryByText('Définir un prix')).toBeNull();
    expect(mockUpsertPrix.mutate).not.toHaveBeenCalled();
    expect(mockSupprimerPrix.mutate).not.toHaveBeenCalled();
  });

  it('commercial : grille illisible, état d’erreur distinct', () => {
    grille({ data: undefined, isError: true });
    render(<MesPrixPage />);
    expect(screen.getByText('Grille de prix indisponible')).toBeTruthy();
    expect(screen.queryByText('Aucun produit')).toBeNull();
  });

  it('principal hors organisation : saisie inchangée', () => {
    grille();
    mockUser = { id: 'l1', prenom: 'Ali', nom: 'K', parentId: null };
    render(<MesPrixPage />);
    expect(screen.getAllByText('Enregistrer')).toHaveLength(2);
    expect(screen.getByText('Modifier le prix')).toBeTruthy();
    expect(screen.queryByText(/Prix fixés par ton responsable/)).toBeNull();
  });

  it('N5 : apprenti hors organisation : prix du principal en lecture seule', () => {
    grille();
    mockUser = { id: 'a1', prenom: 'Awa', nom: 'K', parentId: 'l1' };
    render(<MesPrixPage />);
    expect(screen.getAllByText(/Prix fixés par ton livreur principal/).length).toBeGreaterThan(0);
    expect(screen.getByText('500 FCFA')).toBeTruthy();
    expect(screen.queryByText('Enregistrer')).toBeNull();
    expect(screen.queryByText('Modifier le prix')).toBeNull();
    expect(screen.queryByText(/Prix fixés par ton responsable/)).toBeNull();
    // Pas de champ modifiable : le produit sans prix affiche « Aucun prix fixé ».
    expect(screen.getByText('Aucun prix fixé')).toBeTruthy();
  });
});
