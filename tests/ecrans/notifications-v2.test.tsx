import { fireEvent, render, screen } from '@testing-library/react-native';
import { MontantCommande } from '../../components/livreur/MontantCommande';
import FournisseurCommandes from '../../app/(livreur)/profil/fournisseur-commandes';
import NouvelleCloture from '../../app/(livreur)/clotures/nouvelle';
import CloturesList from '../../app/(livreur)/clotures/index';
import DemandesModification from '../../app/(livreur)/cash/versements/demandes';
import DemanderModificationVersement from '../../app/(livreur)/cash/versements/modifier';
import MesVersements from '../../app/(livreur)/cash/versements/index';
import { naviguer } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { useCommandesFournisseur } from '../../features/commandes/hooks';
import { useCloturesByLivreur } from '../../features/clotures/hooks';
import * as demandesHooks from '../../features/demandes-modif/hooks';
import { useVersementsLivreur } from '../../features/versements/hooks';
import { commandeFixture } from '../../features/commandes/commande.fixture';
import type { DemandeModificationVersementResponse, VersementResponse } from '../../types/api';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => mockParams,
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
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
let mockUser: Record<string, unknown> = { id: 'p1', prenom: 'Jean', nom: 'RACINE', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const mockVide = () => ({ data: [], isLoading: false, isError: false, isFetching: false, refetch: jest.fn() });
jest.mock('../../features/commandes/hooks', () => ({ useCommandesFournisseur: jest.fn() }));
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsByLivreur: () => mockVide() }));
jest.mock('../../features/encaissements/hooks', () => ({ useEncaissementsByLivreur: () => mockVide() }));
const mockEnregistrerCloture = jest.fn();
jest.mock('../../features/clotures/hooks', () => ({
  useEnregistrerCloture: () => ({ mutate: mockEnregistrerCloture, isPending: false }),
  useCloturesByLivreur: jest.fn(),
}));
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({
    data: [
      { id: 'a1', prenom: 'Ali', nom: 'BAMBA', actif: true },
      { id: 'a2', prenom: 'Issa', nom: 'DIALLO', actif: false },
    ],
  }),
}));
const mockApprouver = jest.fn();
const mockRejeter = jest.fn();
const mockCreer = jest.fn();
jest.mock('../../features/demandes-modif/hooks', () => ({
  useDemandesModif: jest.fn(),
  useApprouverDemandeModif: () => ({ mutate: mockApprouver, isPending: false }),
  useRejeterDemandeModif: () => ({ mutate: mockRejeter, isPending: false }),
  useCreerDemandeModif: () => ({ mutate: mockCreer, isPending: false }),
}));
jest.mock('../../features/versements/hooks', () => ({ useVersementsLivreur: jest.fn() }));

const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});

const versement = {
  id: 'v1',
  fournisseur: { id: 'f1', libelle: 'BRASSERIE DU SUD' },
  dateDebut: '2026-10-01T00:00:00',
  dateFin: '2026-10-05T00:00:00',
  dateVersement: '2026-10-06T00:00:00',
  montantVerse: 50000,
  commentaire: null,
} as unknown as VersementResponse;

const demande = (id: string, over: Partial<DemandeModificationVersementResponse> = {}): DemandeModificationVersementResponse => ({
  id,
  versementId: 'v1',
  demandeurType: 'FOURNISSEUR',
  demandeurLibelle: 'BRASSERIE DU SUD',
  payloadModif: { montantVerse: 45000 },
  motifDemande: 'Erreur de saisie',
  statut: 'PENDING',
  decideLe: null,
  motifDecision: null,
  createdAt: '2026-10-10T09:00:00',
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockUser = { id: 'p1', prenom: 'Jean', nom: 'RACINE', parentId: null };
  (useVersementsLivreur as jest.Mock).mockReturnValue(lecture([versement]));
  (useCloturesByLivreur as jest.Mock).mockReturnValue(lecture([]));
});

describe('N2c : montant des commandes', () => {
  it('« Montant estimé » tant que rien n’est livré, puis « Montant livré »', () => {
    const { rerender } = render(<MontantCommande commande={{ montantLivre: null, montantEstime: 4000 }} />);
    expect(screen.getByText(/Montant estimé : 4\s000 F/)).toBeTruthy();
    rerender(<MontantCommande commande={{ montantLivre: 0, montantEstime: 4000 }} variante="detail" />);
    expect(screen.getByText('Montant estimé')).toBeTruthy();
    rerender(<MontantCommande commande={{ montantLivre: 3500, montantEstime: 4000 }} variante="detail" />);
    expect(screen.getByText('Montant livré')).toBeTruthy();
    expect(screen.getByText(/3\s500 FCFA/)).toBeTruthy();
  });

  it('liste des commandes par fournisseur : montant estimé puis livré', () => {
    (useCommandesFournisseur as jest.Mock).mockReturnValue(
      lecture([
        commandeFixture({ id: 'c1', reference: 'CMDE-1', montantEstime: 5000 }),
        commandeFixture({ id: 'c2', reference: 'CMDE-2', statut: 'LIVREE', montantLivre: 4200, montantEstime: 5000 }),
      ]),
    );
    render(<FournisseurCommandes />);
    expect(screen.getByText(/Montant estimé : 5\s000 F/)).toBeTruthy();
    expect(screen.getByText(/Montant livré : 4\s200 F/)).toBeTruthy();
  });
});

describe('N6 : clôture d’un apprenti', () => {
  it('principal : « Moi » ou un apprenti actif ; l’envoi suit le choix', () => {
    render(<NouvelleCloture />);
    expect(screen.getByText('Livreur à clôturer')).toBeTruthy();
    expect(screen.getByText('Moi')).toBeTruthy();
    expect(screen.queryByText('Issa DIALLO')).toBeNull(); // désactivé
    fireEvent.press(screen.getByText('Ali BAMBA'));
    expect(screen.getByText('La remise de l’apprenti sera enregistrée comme déjà confirmée.')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1000');
    fireEvent.press(screen.getByText('Enregistrer la clôture'));
    expect(mockEnregistrerCloture).toHaveBeenCalledTimes(1);
    expect(mockEnregistrerCloture.mock.calls[0][0]).toMatchObject({ livreurId: 'a1', montantRemis: 1000 });
  });

  it('principal : sans choix, il clôture pour lui', () => {
    render(<NouvelleCloture />);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '0');
    fireEvent.press(screen.getByText('Enregistrer la clôture'));
    expect(mockEnregistrerCloture.mock.calls[0][0]).toMatchObject({ livreurId: 'p1' });
  });

  it('apprenti : pas de sélecteur, clôture pour lui', () => {
    mockUser = { id: 'a1', prenom: 'Ali', nom: 'BAMBA', parentId: 'p1' };
    render(<NouvelleCloture />);
    expect(screen.queryByText('Livreur à clôturer')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('0'), '0');
    fireEvent.press(screen.getByText('Enregistrer la clôture'));
    expect(mockEnregistrerCloture.mock.calls[0][0]).toMatchObject({ livreurId: 'a1' });
  });

  it('liste : filtre par livreur et « Nouvelle » garde le choix', () => {
    render(<CloturesList />);
    expect(useCloturesByLivreur).toHaveBeenLastCalledWith('p1');
    fireEvent.press(screen.getByText('Ali BAMBA'));
    expect(useCloturesByLivreur).toHaveBeenLastCalledWith('a1');
    fireEvent.press(screen.getByText('Nouvelle'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/clotures/nouvelle', { livreurId: 'a1' });
  });
});

describe('N7 : demandes de modification de versement', () => {
  it('en attente : avant → après, approuver après confirmation', () => {
    (demandesHooks.useDemandesModif as jest.Mock).mockReturnValue(lecture([demande('d1')]));
    render(<DemandesModification />);
    expect(screen.getByText('Initiée par BRASSERIE DU SUD · 10 oct. 2026')).toBeTruthy();
    expect(screen.getByText(/50\s000 F → 45\s000 F/)).toBeTruthy();
    fireEvent.press(screen.getByText('Approuver'));
    const confirm = (dialog.confirm as jest.Mock).mock.calls[0][0];
    confirm.onConfirm();
    expect(mockApprouver).toHaveBeenCalledWith('d1', expect.anything());
  });

  it('rejeter : motif obligatoire, puis envoyé', () => {
    (demandesHooks.useDemandesModif as jest.Mock).mockReturnValue(lecture([demande('d1')]));
    render(<DemandesModification />);
    fireEvent.press(screen.getByText('Rejeter'));
    fireEvent.press(screen.getByText('Confirmer le rejet'));
    expect(dialog.warning).toHaveBeenCalledWith('Motif manquant', 'Le motif du rejet est obligatoire.');
    expect(mockRejeter).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Motif du rejet'), ' Montant juste ');
    fireEvent.press(screen.getByText('Confirmer le rejet'));
    expect(mockRejeter).toHaveBeenCalledWith({ id: 'd1', motif: 'Montant juste' }, expect.anything());
  });

  it('demande du livreur : en attente du fournisseur, sans boutons ; historique', () => {
    (demandesHooks.useDemandesModif as jest.Mock).mockReturnValue(
      lecture([
        demande('d1', { demandeurType: 'LIVREUR' }),
        demande('d2', { statut: 'REJECTED', motifDecision: 'Montant correct' }),
      ]),
    );
    render(<DemandesModification />);
    expect(screen.getByText('En attente de la décision du fournisseur')).toBeTruthy();
    expect(screen.queryByText('Approuver')).toBeNull();
    expect(screen.getByText('Historique')).toBeTruthy();
    expect(screen.getByText('Rejetée')).toBeTruthy();
    expect(screen.getByText('Motif de la décision : Montant correct')).toBeTruthy();
  });

  it('erreur distincte de l’état vide', () => {
    (demandesHooks.useDemandesModif as jest.Mock).mockReturnValue(
      lecture(undefined, { isError: true, error: new Error('x') }),
    );
    const { unmount } = render(<DemandesModification />);
    expect(screen.getByText('Chargement impossible')).toBeTruthy();
    unmount();
    (demandesHooks.useDemandesModif as jest.Mock).mockReturnValue(lecture([]));
    render(<DemandesModification />);
    expect(screen.getByText('Aucune demande')).toBeTruthy();
  });

  it('Mes versements : accès aux demandes et « Demander une modification »', () => {
    render(<MesVersements />);
    fireEvent.press(screen.getByText('Demandes de modification'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/cash/versements/demandes');
    fireEvent.press(screen.getByText('Demander une modification'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/cash/versements/modifier', { versementId: 'v1' });
  });

  it('demander une modification : champs du web et motif', () => {
    mockParams = { versementId: 'v1' };
    render(<DemanderModificationVersement />);
    fireEvent.changeText(screen.getByLabelText('Nouveau montant versé'), '45000');
    fireEvent.changeText(screen.getByLabelText('Nouveau commentaire'), 'Corrigé');
    fireEvent.changeText(screen.getByLabelText('Motif de la demande'), 'Erreur de saisie');
    fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(mockCreer).toHaveBeenCalledWith(
      {
        versementId: 'v1',
        payloadModif: { montantVerse: 45000, commentaire: 'Corrigé' },
        motifDemande: 'Erreur de saisie',
      },
      expect.anything(),
    );
  });
});
