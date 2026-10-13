import { fireEvent, render, screen, within } from '@testing-library/react-native';
import Accueil from '../../app/(livreur)/index';
import NotificationsResponsable from '../../app/(livreur)/notifications';
import Profil from '../../app/(livreur)/profil/index';
import TransfertsList from '../../app/(livreur)/stock/transferts/index';
import RemisesApprentis from '../../app/(livreur)/profil/remises-apprentis';
import MesCommerciaux from '../../app/(livreur)/profil/apprentis/index';
import FicheCommercial from '../../app/(livreur)/profil/apprentis/[id]';
import { useEncaissementsByLivreur } from '../../features/encaissements/hooks';
import { useClientsByLivreur, useEncoursByLivreur } from '../../features/clients/hooks';
import { useStockActuel } from '../../features/stock/hooks';
import { naviguer, ouvrir } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { useTableauDeBord } from '../../features/organisation/hooks';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import { useStockCourant } from '../../features/stock/hooks';
import type { RemiseArgentResponse, TableauDeBordResponse, TransfertStockResponse } from '../../types/api';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => ({ id: 'k1' }),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
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
const RESPONSABLE = {
  id: 'r1',
  prenom: 'Rita',
  nom: 'Yao',
  username: 'rita',
  parentId: null,
  profile: 'LIVREUR',
  organisationId: 'o1',
  organisationRole: 'RESPONSABLE',
};
let mockUser: Record<string, unknown> = RESPONSABLE;
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser, logout: jest.fn() }),
}));
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ theme: 'system', setTheme: jest.fn() }),
}));
jest.mock('../../features/organisation/hooks', () => ({
  useTableauDeBord: jest.fn(),
  useMonOrganisation: () => ({ data: { raisonSociale: 'Distrib CI', photoUrl: null } }),
}));
jest.mock('../../features/abonnement/hooks', () => ({ useMonAbonnement: () => ({ data: undefined }) }));
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});
// Hooks de vente : jamais appelés pour le responsable.
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsByLivreur: jest.fn() }));
jest.mock('../../features/encaissements/hooks', () => ({ useEncaissementsByLivreur: jest.fn() }));
jest.mock('../../features/clients/hooks', () => ({ useEncoursByLivreur: jest.fn(), useClientsByLivreur: jest.fn() }));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: jest.fn(),
  useMouvementsStock: jest.fn(),
  useStockActuel: jest.fn(),
}));
jest.mock('../../features/commandes/hooks', () => ({ useCommandesAReceptionner: jest.fn() }));
jest.mock('../../features/previsions/hooks', () => ({ usePrevisionsEchues: jest.fn() }));

const mockAccepter = { mutate: jest.fn(), isPending: false };
const mockRefuser = { mutate: jest.fn(), isPending: false };
const mockAnnuler = { mutate: jest.fn(), isPending: false };
let mockTransferts: TransfertStockResponse[] = [];
jest.mock('../../features/transferts/hooks', () => ({
  useTransfertsADecider: () => lecture(mockTransferts),
  useTransfertsParent: () => lecture(mockTransferts),
  useTransfertsLivreur: () => lecture([]),
  useAccepterTransfert: () => mockAccepter,
  useRefuserTransfert: () => mockRefuser,
  useAnnulerTransfert: () => mockAnnuler,
}));
const mockConfirmer = { mutate: jest.fn(), isPending: false };
let mockRemises: RemiseArgentResponse[] = [];
jest.mock('../../features/remises-argent/hooks', () => ({
  useRemisesAConfirmer: () => lecture(mockRemises),
  useRemisesApprentis: () => lecture(mockRemises),
  useConfirmerRemise: () => mockConfirmer,
  useContesterRemise: () => ({ mutate: jest.fn(), isPending: false }),
}));
const mockToggle = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () =>
    lecture([{ id: 'k1', prenom: 'Ali', nom: 'Kone', username: 'ali', contact: null, email: null, actif: true }]),
  useToggleApprentiActif: () => mockToggle,
}));

const ventes = (totalTtc: number, totalAvoirsTtc: number, encaisse: number) => ({
  nombre: totalTtc > 0 ? 1 : 0,
  totalTtc,
  nombreAvoirs: totalAvoirsTtc > 0 ? 1 : 0,
  totalAvoirsTtc,
  netTtc: totalTtc - totalAvoirsTtc,
  encaisse,
});
const TDB: TableauDeBordResponse = {
  date: '2026-10-13',
  ventes: ventes(1500, 500, 1250),
  argentNonRemis: 650,
  commerciaux: [
    {
      commercialId: 'k1',
      nom: 'Kone',
      prenom: 'Ali',
      actif: true,
      ventes: ventes(1500, 500, 1000),
      argent: { encaisse: 1000, remisesConfirmees: 600, remisesEnAttente: 100, nonRemis: 400 },
      camion: { quantiteTotale: 18, valeur: 9000, produitsSansPrix: 0, lignes: [] },
    },
    {
      commercialId: 'k2',
      nom: 'Achi',
      prenom: 'Zoé',
      actif: false,
      ventes: ventes(0, 0, 250),
      argent: { encaisse: 250, remisesConfirmees: 0, remisesEnAttente: 0, nonRemis: 250 },
      camion: { quantiteTotale: 11, valeur: 4900, produitsSansPrix: 0, lignes: [] },
    },
  ],
  depot: {
    quantiteTotale: 121,
    valeur: 47300,
    produitsSansPrix: 1,
    lignes: [
      { produitId: 'p1', code: 'PROD-1', designation: 'Coca', quantite: 70, prixUnitaire: 500, valeur: 35000 },
      { produitId: 'p3', code: 'PROD-3', designation: 'Sprite', quantite: 10, prixUnitaire: null, valeur: null },
    ],
  },
  camions: { quantiteTotale: 29, valeur: 13900, produitsSansPrix: 0, lignes: [] },
  enTransit: { versCommerciaux: 4, versDepot: 2, lignes: [] },
  encours: { total: 350, nombreClients: 1, avances: 0 },
  nombreDemandesEnAttente: 1,
  demandesEnAttente: [
    {
      id: 'd1',
      reference: 'DCH-1',
      date: '2026-10-13T10:55:15',
      statut: 'EN_ATTENTE',
      commercialId: 'k2',
      commercialNom: 'Achi',
      commercialPrenom: 'Zoé',
      motifRefus: null,
      dateTraitement: null,
      traiteParId: null,
      quantiteTotaleDemandee: 5,
      quantiteTotaleServie: null,
      lignes: [],
    },
  ],
};

const livreur = (id: string, prenom: string) => ({ id, prenom, nom: 'X' }) as never;
const dechargement = (statut: TransfertStockResponse['statut'] = 'EN_ATTENTE'): TransfertStockResponse => ({
  id: 't1',
  source: livreur('k1', 'Ali'),
  destinataire: livreur('r1', 'Rita'),
  reference: 'TRF-1',
  lignes: [{ produit: { id: 'p1', code: 'PROD-1', designation: 'Coca' }, qte: 3 }],
  dateTransfert: '2026-10-13T09:00:00',
  commentaire: null,
  statut,
  motifRefus: null,
  initieParId: 'k1',
  decideParId: null,
  dateDecision: null,
  reprise: false,
  decideurId: 'r1',
});
const chargement: TransfertStockResponse = {
  ...dechargement(),
  id: 't2',
  source: livreur('r1', 'Rita'),
  destinataire: livreur('k1', 'Ali'),
  initieParId: 'r1',
  decideurId: 'k1',
};
const remise: RemiseArgentResponse = {
  id: 'm1',
  reference: 'REM-1',
  apprenti: livreur('k1', 'Ali'),
  principal: livreur('r1', 'Rita'),
  montant: 600,
  dateRemise: '2026-10-13T18:00:00',
  commentaire: null,
  statut: 'DECLAREE',
  motifContestation: null,
  decideParId: null,
  dateDecision: null,
  clotureId: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = RESPONSABLE;
  mockTransferts = [];
  mockRemises = [];
  (useTableauDeBord as jest.Mock).mockReturnValue(lecture(TDB));
});

describe('Accueil du responsable : tableau de bord (O15, O16)', () => {
  it('aucune requête de vente, chiffres et libellés du tableau de bord', () => {
    mockTransferts = [dechargement()];
    mockRemises = [remise];
    render(<Accueil />);
    expect(useLivraisonsByLivreur).not.toHaveBeenCalled();
    expect(useStockCourant).not.toHaveBeenCalled();

    expect(screen.getByText('Tableau de bord')).toBeTruthy();
    expect(screen.getByText('Distrib CI')).toBeTruthy();
    expect(screen.getByText('Aujourd’hui')).toBeTruthy();
    // Ventes : Facturé / Avoirs / Net, Encaissements du jour.
    expect(screen.getAllByText('Facturé / Avoirs / Net').length).toBe(3);
    // Total et Ali (seul à avoir vendu).
    expect(screen.getAllByText('1 500 / 500 / 1 000 FCFA')).toHaveLength(2);
    expect(screen.getAllByText('Encaissements du jour').length).toBe(3);
    expect(screen.getByText('1 250 FCFA')).toBeTruthy();
    // Argent non remis, à côté des remises en attente.
    expect(screen.getByText('650 FCFA')).toBeTruthy();
    expect(screen.getAllByText('Remises en attente').length).toBeGreaterThan(0);
    // Par commercial.
    const ali = within(screen.getByLabelText('Commercial Ali Kone'));
    expect(ali.getByText('400 FCFA')).toBeTruthy();
    expect(ali.getByText('100 FCFA')).toBeTruthy();
    expect(ali.getByText('18 u. · 9 000 FCFA')).toBeTruthy();
    expect(within(screen.getByLabelText('Commercial Zoé Achi')).getByText('Inactif')).toBeTruthy();
    // État actuel : dépôt (valeur incomplète), camions, transit, encours, demandes.
    expect(screen.getAllByText('État actuel').length).toBe(5);
    expect(screen.getByText('47 300 FCFA')).toBeTruthy();
    expect(screen.getAllByText('valeur incomplète')).toHaveLength(1);
    expect(screen.getByText('Sprite : 10 u. · sans prix')).toBeTruthy();
    expect(screen.getByText('13 900 FCFA')).toBeTruthy();
    expect(screen.getByText('4 u.')).toBeTruthy();
    expect(screen.getByText('350 FCFA')).toBeTruthy();
    expect(screen.getByText('DCH-1 · Zoé Achi · 5 u.')).toBeTruthy();
    // À traiter → Notifications.
    expect(screen.getByText('1 déchargement à accepter · 1 remise à confirmer')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('À traiter'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/notifications');
  });

  it('jour précédent : relu pour ce jour ; pas de jour après aujourd’hui', () => {
    render(<Accueil />);
    const jour = (useTableauDeBord as jest.Mock).mock.calls[0][0] as string;
    fireEvent.press(screen.getByLabelText('Jour suivant'));
    expect((useTableauDeBord as jest.Mock).mock.calls.at(-1)?.[0]).toBe(jour);
    fireEvent.press(screen.getByLabelText('Jour précédent'));
    expect(screen.getByText('Hier')).toBeTruthy();
    expect((useTableauDeBord as jest.Mock).mock.calls.at(-1)?.[0]).not.toBe(jour);
  });

  it('erreur de lecture : état distinct, avec le message du back', () => {
    (useTableauDeBord as jest.Mock).mockReturnValue(
      lecture(undefined, { isError: true, error: { response: { data: { message: 'Accès refusé : ressource inaccessible' } } } }),
    );
    render(<Accueil />);
    expect(screen.getByText('Tableau de bord indisponible')).toBeTruthy();
    expect(screen.getByText('Accès refusé : ressource inaccessible')).toBeTruthy();
    expect(screen.queryByText('État actuel')).toBeNull();
  });
});

describe('Notifications du responsable', () => {
  it('déchargement : Accepter (envoi unique) et Refuser ; jamais d’Annuler', () => {
    mockTransferts = [dechargement(), chargement];
    render(<NotificationsResponsable />);
    expect(screen.getByText('Déchargements à accepter')).toBeTruthy();
    expect(screen.queryByText('Annuler')).toBeNull();
    fireEvent.press(screen.getByText('Accepter'));
    const { onConfirm } = (dialog.confirm as jest.Mock).mock.calls[0][0];
    onConfirm();
    onConfirm();
    expect(mockAccepter.mutate).toHaveBeenCalledTimes(1);
    expect(mockAccepter.mutate.mock.calls[0][0]).toBe('t1');
    expect(screen.getByText('Refuser')).toBeTruthy();
  });

  it('remise déclarée : Confirmer (envoi unique) et Contester', () => {
    mockRemises = [remise];
    render(<NotificationsResponsable />);
    fireEvent.press(screen.getByText('Confirmer'));
    const { onConfirm } = (dialog.confirm as jest.Mock).mock.calls[0][0];
    onConfirm();
    onConfirm();
    expect(mockConfirmer.mutate).toHaveBeenCalledTimes(1);
    expect(mockConfirmer.mutate.mock.calls[0][0]).toBe('m1');
    expect(screen.getByText('Contester')).toBeTruthy();
  });

  it('listes vides et liens vers les listes complètes (retour aux Notifications)', () => {
    render(<NotificationsResponsable />);
    expect(screen.getByText('Aucun déchargement à accepter')).toBeTruthy();
    expect(screen.getByText('Aucune remise à confirmer')).toBeTruthy();
    fireEvent.press(screen.getByText('Voir tous les transferts'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/stock/transferts', { depuis: 'notifications-responsable' });
    fireEvent.press(screen.getByText('Voir toutes les remises'));
    expect(ouvrir).toHaveBeenLastCalledWith('/(livreur)/profil/remises-apprentis', {
      depuis: 'notifications-responsable',
    });
  });
});

describe('Moi, Transferts et Remises du responsable', () => {
  it('Moi : compte et ses deux actions, sans gestion ni ventes', () => {
    render(<Profil />);
    expect(screen.getByText('rita · Responsable')).toBeTruthy();
    expect(screen.getByText('Modifier mes infos')).toBeTruthy();
    expect(screen.getByText('Changer le mot de passe')).toBeTruthy();
    expect(screen.getByText('Mes commerciaux')).toBeTruthy();
    for (const absent of ['Mes prix de vente', 'Mes fournisseurs', 'États', 'Prévisions', 'Dépenses', 'Mes reversements', 'Clôtures journalières'])
      expect(screen.queryByText(absent)).toBeNull();
    fireEvent.press(screen.getByText('Transferts de stock'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/stock/transferts');
    fireEvent.press(screen.getByText('Remises des commerciaux'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/profil/remises-apprentis');
    expect(screen.getByText(/se gèrent sur le portail web/)).toBeTruthy();
  });

  it('Transferts : ni « Nouveau » ni « Annuler », Accepter et Refuser restent', () => {
    mockTransferts = [dechargement(), chargement];
    render(<TransfertsList />);
    expect(screen.queryByText('Nouveau')).toBeNull();
    expect(screen.queryByText('Annuler')).toBeNull();
    expect(screen.getByText('Accepter')).toBeTruthy();
    expect(screen.getByText('Refuser')).toBeTruthy();
  });

  it('Transferts d’un livreur principal : « Nouveau » et « Annuler » inchangés', () => {
    mockUser = { id: 'r1', prenom: 'Rita', nom: 'Yao', parentId: null };
    mockTransferts = [chargement];
    render(<TransfertsList />);
    expect(screen.getByText('Nouveau')).toBeTruthy();
    expect(screen.getByText('Annuler')).toBeTruthy();
  });

  it('Remises : vocabulaire de l’organisation', () => {
    render(<RemisesApprentis />);
    expect(screen.getByText('Remises des commerciaux')).toBeTruthy();
    expect(screen.getByText('Commercial')).toBeTruthy();
  });
  it('Mes commerciaux : liste en lecture, ni « Nouveau » ni activation', () => {
    render(<MesCommerciaux />);
    expect(screen.getByText('Mes commerciaux')).toBeTruthy();
    expect(screen.getByText('Ali Kone')).toBeTruthy();
    expect(screen.queryByText('Nouveau')).toBeNull();
    fireEvent.press(screen.getByText('Ali Kone'));
    expect(naviguer).toHaveBeenLastCalledWith('/(livreur)/profil/apprentis/[id]', { id: 'k1' });
    expect(mockToggle.mutate).not.toHaveBeenCalled();
  });

  it('fiche commercial : lecture seule, sans Activer ni Désactiver', () => {
    for (const h of [useLivraisonsByLivreur, useEncaissementsByLivreur, useClientsByLivreur, useEncoursByLivreur, useStockActuel])
      (h as jest.Mock).mockReturnValue(lecture([]));
    render(<FicheCommercial />);
    expect(screen.getAllByText('Ali Kone').length).toBeGreaterThan(0);
    expect(screen.getByText('Commercial')).toBeTruthy();
    expect(screen.queryByText('Désactiver')).toBeNull();
    expect(screen.queryByText('Activer')).toBeNull();
    expect(screen.getByText('Voir toutes les remises')).toBeTruthy();
  });
});
