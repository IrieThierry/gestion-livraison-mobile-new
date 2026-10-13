import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Notifications from '../../app/(livreur)/previsions/echues';
import PrevisionsList from '../../app/(livreur)/previsions/index';
import NouvellePrevision from '../../app/(livreur)/previsions/nouvelle';
import NouvelleLivraison from '../../app/(livreur)/livraisons/nouvelle';
import { dialog } from '../../lib/dialog';
import { ouvrir } from '../../lib/navigation-app';
import * as hooks from '../../features/previsions/hooks';
import { ajouterJours, jourLocal, regrouperPrevisions } from '../../features/previsions/regles';
import type { PrevisionResponse } from '../../types/api';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
}));
// Partage de la facture du commercial (PDF natif) : hors de ce test.
jest.mock('../../features/organisation/usePartageDocuments', () => ({
  usePartageDocuments: () => ({ enCours: null, facture: jest.fn(), factureDeLivraison: jest.fn(), avoir: jest.fn() }),
  apresFermetureDialogue: jest.fn(),
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
let mockOnline = true;
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: mockOnline }),
}));
jest.mock('../../features/previsions/hooks', () => ({
  ErreurEnregistrementPartiel: class extends Error {},
  usePrevisionsEchues: jest.fn(),
  useSupprimerGroupes: jest.fn(),
  useReporterGroupes: jest.fn(),
  usePlusTard: jest.fn(),
  usePrevisionsLivreur: jest.fn(),
  usePrevisionsParent: jest.fn(),
  useLivraisonsDuJour: jest.fn(),
  useCumul: jest.fn(),
  useModifierGroupe: jest.fn(),
  useEnregistrerPrevisions: jest.fn(),
}));
let mockRemises: unknown = [];
const mockConfirmer = { mutate: jest.fn(), isPending: false };
const mockContester = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/remises-argent/hooks', () => ({
  useRemisesAConfirmer: () => ({ data: mockRemises, isLoading: false, isError: mockRemises === undefined, refetch: jest.fn() }),
  useConfirmerRemise: () => mockConfirmer,
  useContesterRemise: () => mockContester,
}));
let mockTransferts: unknown = [];
const mockAccepter = { mutate: jest.fn(), isPending: false };
const mockRefuser = { mutate: jest.fn(), isPending: false };
const mockAnnuler = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/transferts/hooks', () => ({
  useTransfertsADecider: () => ({ data: mockTransferts, isLoading: false, isError: mockTransferts === undefined, refetch: jest.fn() }),
  useAccepterTransfert: () => mockAccepter,
  useRefuserTransfert: () => mockRefuser,
  useAnnulerTransfert: () => mockAnnuler,
}));
jest.mock('../../features/commandes/hooks', () => ({
  useCommandesAReceptionner: () => ({ data: [{}, {}], isError: false, refetch: jest.fn() }),
}));
jest.mock('../../features/lookups/hooks', () => ({
  useFournisseursPartenaires: () => ({ data: [{ id: 'f1', libelle: 'Boulangerie' }], isLoading: false, isError: false }),
}));
jest.mock('../../features/clients/hooks', () => ({
  useClientsByLivreur: () => ({ data: [{ id: 'c1', prenom: 'Awa', nom: 'T', prixDeVenteProduitParDefault: 150 }], isLoading: false }),
  useEncoursByLivreur: () => ({ data: [] }),
}));
jest.mock('../../features/produits/hooks', () => ({
  useProduits: () => ({ data: [{ id: 'p1', code: 'P1', designation: 'Pain' }] }),
}));
jest.mock('../../features/livraisons/hooks', () => ({
  useCreerLivraison: () => ({ mutate: jest.fn(), isPending: false }),
}));
// Livraison : client choisi d'un appui, lignes affichées en texte.
jest.mock('../../components/livreur/ClientPicker', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    ClientPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
      <Text onPress={() => onChange({ id: 'c1', prenom: 'Awa', nom: 'T', prixDeVenteProduitParDefault: 150 })}>
        choisir-client
      </Text>
    ),
  };
});
jest.mock('../../components/livreur/ProduitPicker', () => {
  const { Text, View } = jest.requireActual('react-native');
  return {
    ProduitPicker: ({ lignes, onChange }: { lignes: Array<{ designation: string; qte: number; prix: number }>; onChange: (l: unknown[]) => void }) => (
      <View>
        {lignes.map((l) => (
          <Text key={l.designation}>{`ligne ${l.designation} x${l.qte} à ${l.prix}`}</Text>
        ))}
        <Text onPress={() => onChange([])}>vider-lignes</Text>
      </View>
    ),
  };
});
jest.mock('../../features/prix/hooks', () => ({
  useMesPrixAchat: () => ({ data: undefined, isSuccess: false, isError: false }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

const h = hooks as unknown as Record<string, jest.Mock>;
const aujourdhui = jourLocal();
const hier = ajouterJours(aujourdhui, -1);
const client = { id: 'c1', prenom: 'Awa', nom: 'T' };
const PAIN = { id: 'p1', code: 'P1', designation: 'Pain' };
const prev = (id: string, jour: string, qte: number, livreur = { id: 'L1', prenom: 'Ali', nom: 'K' }): PrevisionResponse =>
  ({ id, livreur, client, produit: PAIN, qteEstimee: qte, dateLivraison: `${jour}T00:00:00`, commentaire: null }) as never;
const lecture = (data: unknown) => ({ data, isLoading: false, isError: false, isFetching: false, refetch: jest.fn() });
const mutation = () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false });

const clients: QueryClient[] = [];
const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity }, mutations: { gcTime: Infinity } } });
  clients.push(qc);
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};
afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: null };
  mockOnline = true;
  mockParams = {};
  mockRemises = [];
  mockTransferts = [];
  for (const n of ['useSupprimerGroupes', 'useReporterGroupes', 'usePlusTard', 'useModifierGroupe', 'useEnregistrerPrevisions'])
    h[n].mockReturnValue(mutation());
});

describe('Notifications (cloche)', () => {
  const echue = regrouperPrevisions([prev('a', hier, 5)], [])[0];
  beforeEach(() => {
    h.usePrevisionsEchues.mockReturnValue({ echues: [echue], isLoading: false, isError: false, partiel: false, refetch: jest.fn() });
  });

  it('deux rubriques : commandes (ouvre la liste, retour ici) et échues', () => {
    render(<Notifications />);
    fireEvent.press(screen.getByText('2 commandes à réceptionner'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/a-receptionner', { depuis: 'notifications' });
    expect(screen.getByText('Awa T')).toBeTruthy();
    expect(screen.getByText('Pain')).toBeTruthy();
  });

  it('Supprimer demande une confirmation explicite avant toute suppression', () => {
    render(<Notifications />);
    fireEvent.press(screen.getByText('Supprimer'));
    expect(dialog.confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Supprimer' }));
    expect(h.useSupprimerGroupes.mock.results[0].value.mutate).not.toHaveBeenCalled();
    (dialog.confirm as jest.Mock).mock.calls[0][0].onConfirm();
    expect(h.useSupprimerGroupes.mock.results[0].value.mutate).toHaveBeenCalledWith([echue], expect.anything());
  });

  it('Reporter propose Aujourd’hui / Demain ; Plus tard mémorise le groupe', () => {
    render(<Notifications />);
    fireEvent.press(screen.getByText('Reporter'));
    const actions = (dialog.info as jest.Mock).mock.calls[0][2].actions as Array<{ label: string; onPress?: () => void }>;
    expect(actions.map((a) => a.label)).toEqual(expect.arrayContaining([expect.stringMatching(/^Aujourd’hui/), expect.stringMatching(/^Demain/)]));
    actions.find((a) => a.label.startsWith('Demain'))!.onPress!();
    expect(h.useReporterGroupes.mock.results[0].value.mutate).toHaveBeenCalledWith(
      { groupes: [echue], jourCible: ajouterJours(aujourdhui, 1) },
      expect.anything(),
    );
    fireEvent.press(screen.getByText('Plus tard'));
    expect(h.usePlusTard.mock.results[0].value.mutate).toHaveBeenCalledWith([echue.cle], expect.anything());
  });

  it('hors ligne : Supprimer et Reporter désactivés, bandeau affiché', () => {
    mockOnline = false;
    render(<Notifications />);
    expect(screen.getByText(/Hors ligne/)).toBeTruthy();
    fireEvent.press(screen.getByText('Supprimer'));
    fireEvent.press(screen.getByText('Reporter'));
    expect(dialog.confirm).not.toHaveBeenCalled();
    expect(dialog.info).not.toHaveBeenCalled();
  });
  const remise = {
    id: 'r1', reference: 'REM-4', montant: 7000, dateRemise: '2026-10-10T09:00:00', statut: 'DECLAREE',
    apprenti: { id: 'A1', prenom: 'Issa', nom: 'B' }, commentaire: null, motifContestation: null,
  };

  it('principal : rubrique « Remises à confirmer » avec Confirmer et Contester', () => {
    mockRemises = [remise];
    render(<Notifications />);
    expect(screen.getByText('Remises à confirmer')).toBeTruthy();
    expect(screen.getByText('REM-4')).toBeTruthy();
    fireEvent.press(screen.getByText('Confirmer'));
    (dialog.confirm as jest.Mock).mock.calls[0][0].onConfirm();
    expect(mockConfirmer.mutate).toHaveBeenCalledWith('r1', expect.anything());
    fireEvent.press(screen.getByText('Contester'));
    const boutons = screen.getAllByText('Contester');
    fireEvent.press(boutons[boutons.length - 1]);
    expect(screen.getByText('Précisez le motif de la contestation.')).toBeTruthy();
    expect(mockContester.mutate).not.toHaveBeenCalled();
  });

  it('principal : aucune remise, ou lecture impossible', () => {
    const { unmount } = render(<Notifications />);
    expect(screen.getByText('Aucune remise à confirmer')).toBeTruthy();
    unmount();
    mockRemises = undefined;
    render(<Notifications />);
    expect(screen.getByText('Remises à confirmer indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucune remise à confirmer')).toBeNull();
  });

  const transfert = {
    id: 't1', reference: 'TRF-1', dateTransfert: '2026-10-12T10:00:00', statut: 'EN_ATTENTE', commentaire: null, motifRefus: null,
    source: { id: 'P0', prenom: 'Awa', nom: 'K' }, destinataire: { id: 'L1', prenom: 'Ali', nom: 'K' },
    lignes: [{ produit: { id: 'p1', designation: 'Pain' }, qte: 4 }], initieParId: 'P0', decideurId: 'L1', reprise: false,
    decideParId: null, dateDecision: null,
  };

  it('« Transferts à recevoir » : Accepter, Refuser, et la liste ouverte depuis Notifications', () => {
    mockUser = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: 'P0' };
    mockTransferts = [transfert];
    render(<Notifications />);
    expect(screen.getByText('Transferts à recevoir')).toBeTruthy();
    expect(screen.getByText('TRF-1')).toBeTruthy();
    expect(screen.getByText('Pain × 4')).toBeTruthy();
    fireEvent.press(screen.getByText('Accepter'));
    (dialog.confirm as jest.Mock).mock.calls[0][0].onConfirm();
    expect(mockAccepter.mutate).toHaveBeenCalledWith('t1', expect.anything());
    expect(screen.getByText('Refuser')).toBeTruthy();
    fireEvent.press(screen.getByText('Voir tous les transferts'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/stock/transferts', { depuis: 'notifications' });
  });

  it('« Transferts à recevoir » : aucun, ou lecture impossible', () => {
    const { unmount } = render(<Notifications />);
    expect(screen.getByText('Aucun transfert à recevoir')).toBeTruthy();
    unmount();
    mockTransferts = undefined;
    render(<Notifications />);
    expect(screen.getByText('Transferts à recevoir indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucun transfert à recevoir')).toBeNull();
  });

  it('apprenti : pas de rubrique remises', () => {
    mockUser = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: 'P0' };
    mockRemises = [remise];
    render(<Notifications />);
    expect(screen.queryByText('Remises à confirmer')).toBeNull();
    expect(screen.queryByText('REM-4')).toBeNull();
  });
});

describe('Liste des prévisions', () => {
  const demain = ajouterJours(aujourdhui, 1);
  beforeEach(() => {
    h.usePrevisionsLivreur.mockReturnValue(lecture([prev('a', demain, 3), prev('b', demain, 2)]));
    h.usePrevisionsParent.mockReturnValue(
      lecture([prev('a', demain, 3), prev('z', demain, 4, { id: 'A1', prenom: 'Zoé', nom: 'B' })]),
    );
    h.useLivraisonsDuJour.mockReturnValue(lecture([]));
    h.useCumul.mockReturnValue(lecture([{ produit: PAIN, qteCumulee: 5 }]));
  });

  it('une ligne regroupée (Prévu 5), bloc apprenti en lecture seule, Commander pour le principal', () => {
    render(<PrevisionsList />);
    expect(screen.getAllByLabelText('Modifier Pain')).toHaveLength(1);
    expect(screen.getByText('Zoé B (lecture seule)')).toBeTruthy();
    expect(screen.getByText('Commander')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Supprimer Pain'));
    expect(dialog.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('2 prévisions regroupées seront supprimées') }),
    );
  });

  it('apprenti : pas de Commander ni de bloc équipe', () => {
    mockUser = { id: 'L1', prenom: 'Ali', nom: 'K', parentId: 'P0' };
    render(<PrevisionsList />);
    expect(screen.queryByText('Commander')).toBeNull();
    expect(screen.queryByText(/lecture seule/)).toBeNull();
  });

  it('livraisons pas encore lues : ni Livré, ni pastille', () => {
    h.useLivraisonsDuJour.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: jest.fn() });
    render(<PrevisionsList />);
    expect(screen.queryByText('À livrer')).toBeNull();
    expect(screen.getAllByText(/Livré … · Écart …/).length).toBeGreaterThan(0);
  });
});

describe('Nouvelle prévision : date prévue', () => {
  it('demain par défaut, libellé « Enregistrer pour le … »', () => {
    render(<NouvellePrevision />);
    const [, m, d] = ajouterJours(aujourdhui, 1).split('-');
    expect(screen.getByText(new RegExp(`^Enregistrer pour le .+ ${d}/${m}$`))).toBeTruthy();
  });

  it('une date passée en paramètre est ignorée (demain)', () => {
    mockParams = { date: hier };
    render(<NouvellePrevision />);
    expect(screen.getByText(ajouterJours(aujourdhui, 1))).toBeTruthy();
  });
});

describe('Nouvelle livraison préremplie', () => {
  beforeEach(() => {
    h.usePrevisionsLivreur.mockReturnValue(lecture([prev('a', aujourdhui, 5)]));
    h.useLivraisonsDuJour.mockReturnValue(
      lecture([{ livreur: { id: 'L1' }, client, date: `${aujourdhui}T08:00:00`, produitsLivraison: [{ produit: PAIN, qteLivre: 2 }] }]),
    );
  });

  it('client choisi, formulaire vide : lignes = Reste au prix habituel ; vidées : « Reprendre les prévisions »', () => {
    wrap(<NouvelleLivraison />);
    fireEvent.press(screen.getByText('choisir-client'));
    expect(screen.getByText('ligne Pain x3 à 150')).toBeTruthy();
    expect(screen.getByText('Prérempli depuis les prévisions du jour')).toBeTruthy();
    expect(screen.queryByText('Reprendre les prévisions')).toBeNull();

    fireEvent.press(screen.getByText('vider-lignes'));
    fireEvent.press(screen.getByText('Reprendre les prévisions'));
    expect(screen.getByText('ligne Pain x3 à 150')).toBeTruthy();
  });
});
