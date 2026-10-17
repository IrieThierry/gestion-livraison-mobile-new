import { fireEvent, render, screen } from '@testing-library/react-native';
import CommandeDetail from '../../app/(livreur)/cash/commandes/[id]';
import CommandesAReceptionner from '../../app/(livreur)/cash/commandes/a-receptionner';
import { BandeauRemisesCommis } from '../../components/livreur/BandeauRemisesCommis';
import * as hooks from '../../features/commandes/hooks';
import * as remises from '../../features/commandes/remises';
import { commandeFixture, ligneCommandeFixture } from '../../features/commandes/commande.fixture';
import { dialog } from '../../lib/dialog';
import { naviguer, ouvrir } from '../../lib/navigation-app';
import type { RemiseCommisResponse } from '../../types/api';

let mockUser: Record<string, unknown> = { id: 'l-1', prenom: 'Ahmed', nom: 'Koné', parentId: null, profile: 'LIVREUR' };
jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/cash/commandes/c-1',
  useLocalSearchParams: () => ({ id: 'c-1' }),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: () => true },
}));
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
}));
jest.mock('../../lib/dialog', () => ({
  dialog: { confirm: jest.fn(), info: jest.fn(), success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../components/livreur/ApprentiAffecteField', () => ({ ApprentiAffecteField: () => null }));
jest.mock('../../features/commandes/hooks', () => ({
  useCommande: jest.fn(),
  useAnnulerCommande: jest.fn(),
  useReceptionner: jest.fn(),
  usePasserLivree: jest.fn(),
  useAffecterApprenti: jest.fn(),
  useCommandesAReceptionner: jest.fn(),
}));
jest.mock('../../features/commandes/remises', () => ({
  useRemisesCommisDeCommande: jest.fn(),
  useRemisesCommisAConfirmer: jest.fn(),
  useConfirmerRemiseCommis: jest.fn(),
  useRefuserRemiseCommis: jest.fn(),
}));

const h = (n: keyof typeof hooks) => hooks[n] as unknown as jest.Mock;
const r = (n: keyof typeof remises) => remises[n] as unknown as jest.Mock;
const lecture = (data: unknown) => ({ data, isLoading: false, isError: false, isFetching: false, error: null, refetch: jest.fn() });
const mutation = () => ({ mutate: jest.fn(), isPending: false });

const REMISE: RemiseCommisResponse = {
  id: 'r1',
  commandeId: 'c-1',
  commandeNumero: 'CMDE-1',
  livreur: { id: 'l-1', nom: 'Koné', prenom: 'Ahmed' },
  commis: { id: 'k1', nom: 'TRAORÉ', prenom: 'Awa' },
  statut: 'EN_ATTENTE',
  lignes: [
    { produitFournisseurId: 'pf1', designation: 'Riz 25 kg', photoUrl: '/uploads/p/riz.jpg', quantite: 6 },
    { produitFournisseurId: 'pf2', designation: 'Huile 5 L', photoUrl: null, quantite: 4 },
  ],
  creeLe: '2026-10-16T09:30:00',
  reponduLe: null,
  motif: null,
};

const commandeCommis = (o: Record<string, unknown> = {}) =>
  commandeFixture({
    id: 'c-1',
    statut: 'EN_RECEPTION',
    gereeParCommis: true,
    remisesEnAttente: 1,
    produitsCommandes: [ligneCommandeFixture('p1', 'Riz 25 kg', 10, 4)],
    ...o,
  });

let mConfirmer: ReturnType<typeof mutation>;
let mRefuser: ReturnType<typeof mutation>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'l-1', prenom: 'Ahmed', nom: 'Koné', parentId: null, profile: 'LIVREUR' };
  h('useCommande').mockReturnValue(lecture(commandeCommis()));
  for (const n of ['useAnnulerCommande', 'useReceptionner', 'usePasserLivree', 'useAffecterApprenti'] as const) {
    h(n).mockReturnValue(mutation());
  }
  r('useRemisesCommisDeCommande').mockReturnValue(lecture([REMISE]));
  mConfirmer = mutation();
  mRefuser = mutation();
  r('useConfirmerRemiseCommis').mockReturnValue(mConfirmer);
  r('useRefuserRemiseCommis').mockReturnValue(mRefuser);
});

const confirmerDialog = () => (dialog.confirm as jest.Mock).mock.calls[0][0] as { onConfirm: () => void; title: string };

describe('Détail commande : remises du commis à confirmer', () => {
  it('affiche la remise en attente : commis, date, produits et quantités', () => {
    render(<CommandeDetail />);
    expect(screen.getByText('Remises à confirmer')).toBeTruthy();
    expect(screen.getByText('Remise de Awa TRAORÉ · 16/10/2026 09:30')).toBeTruthy();
    expect(screen.getByText('6 × Riz 25 kg')).toBeTruthy();
    expect(screen.getByText('4 × Huile 5 L')).toBeTruthy();
    expect(r('useRemisesCommisDeCommande')).toHaveBeenCalledWith('c-1', true);
  });

  it('Confirmer : confirmation puis un seul POST malgré deux appuis, succès signalé', () => {
    render(<CommandeDetail />);
    fireEvent.press(screen.getByLabelText('Confirmer la remise de Awa TRAORÉ'));
    const d = confirmerDialog();
    d.onConfirm();
    d.onConfirm();
    expect(mConfirmer.mutate).toHaveBeenCalledTimes(1);
    expect(mConfirmer.mutate.mock.calls[0][0]).toBe('r1');
    mConfirmer.mutate.mock.calls[0][1].onSuccess();
    expect(dialog.success).toHaveBeenCalledWith('Remise confirmée');
  });

  it('Confirmer refusé par le serveur : message affiché tel quel', () => {
    render(<CommandeDetail />);
    fireEvent.press(screen.getByLabelText('Confirmer la remise de Awa TRAORÉ'));
    confirmerDialog().onConfirm();
    mConfirmer.mutate.mock.calls[0][1].onError({
      isAxiosError: true,
      response: { status: 400, data: { message: 'Cette remise n’est plus en attente.' } },
    });
    expect(dialog.error).toHaveBeenCalledWith('Confirmation refusée', expect.any(String));
  });

  it('Refuser sans motif : « Le motif est obligatoire. » sans appel ; avec motif : POST du motif saisi', () => {
    render(<CommandeDetail />);
    fireEvent.press(screen.getByLabelText('Refuser la remise de Awa TRAORÉ'));
    fireEvent.changeText(screen.getByPlaceholderText('Motif du refus'), '   ');
    fireEvent.press(screen.getByText('Envoyer le refus'));
    expect(screen.getByText('Le motif est obligatoire.')).toBeTruthy();
    expect(mRefuser.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByPlaceholderText('Motif du refus'), '  Il manque 2 sacs ');
    fireEvent.press(screen.getByText('Envoyer le refus'));
    fireEvent.press(screen.getByText('Envoyer le refus'));
    expect(mRefuser.mutate).toHaveBeenCalledTimes(1);
    expect(mRefuser.mutate.mock.calls[0][0]).toEqual({ id: 'r1', motif: 'Il manque 2 sacs' });
    mRefuser.mutate.mock.calls[0][1].onSuccess();
    expect(dialog.success).toHaveBeenCalledWith('Remise refusée');
  });

  it('gereeParCommis : ni Réceptionner ni Passer à Livrée, mention du commis', () => {
    render(<CommandeDetail />);
    expect(screen.queryByText('Réceptionner')).toBeNull();
    expect(screen.queryByText('Passer à Livrée')).toBeNull();
    expect(screen.getByText('Les remises sont faites par le commis du fournisseur')).toBeTruthy();
  });

  it('sans commis : boutons de réception habituels, aucune remise lue', () => {
    h('useCommande').mockReturnValue(lecture(commandeCommis({ gereeParCommis: false, remisesEnAttente: 0 })));
    r('useRemisesCommisDeCommande').mockReturnValue(lecture(undefined));
    render(<CommandeDetail />);
    expect(screen.getByText('Réceptionner')).toBeTruthy();
    expect(screen.getByText('Passer à Livrée')).toBeTruthy();
    expect(screen.queryByText('Les remises sont faites par le commis du fournisseur')).toBeNull();
    expect(screen.queryByText('Remises à confirmer')).toBeNull();
    expect(r('useRemisesCommisDeCommande')).toHaveBeenCalledWith('c-1', false);
  });

  it('remise déjà traitée : visible sans boutons (motif du refus affiché)', () => {
    r('useRemisesCommisDeCommande').mockReturnValue(
      lecture([{ ...REMISE, statut: 'REFUSEE', motif: 'Sacs abîmés', reponduLe: '2026-10-16T10:00:00' }]),
    );
    render(<CommandeDetail />);
    expect(screen.queryByText('Remises à confirmer')).toBeNull();
    expect(screen.getByText('Remises du commis')).toBeTruthy();
    expect(screen.getByText('Refusée')).toBeTruthy();
    expect(screen.getByText('Motif : Sacs abîmés')).toBeTruthy();
    expect(screen.queryByLabelText('Confirmer la remise de Awa TRAORÉ')).toBeNull();
  });

  it('apprenti affecté : peut confirmer aussi', () => {
    mockUser = { id: 'a-1', prenom: 'Ali', nom: 'Bamba', parentId: 'l-1', profile: 'LIVREUR' };
    render(<CommandeDetail />);
    fireEvent.press(screen.getByLabelText('Confirmer la remise de Awa TRAORÉ'));
    confirmerDialog().onConfirm();
    expect(mConfirmer.mutate).toHaveBeenCalledTimes(1);
  });

  it('commande terminée par le commis : « Passée à Livrée par » le commis', () => {
    h('useCommande').mockReturnValue(
      lecture(
        commandeCommis({
          statut: 'LIVREE',
          remisesEnAttente: 0,
          livreeManuellement: true,
          livreePar: { id: 'k1', nom: 'Awa TRAORÉ' },
          dateLivree: '2026-10-16T18:00:00',
        }),
      ),
    );
    r('useRemisesCommisDeCommande').mockReturnValue(lecture([{ ...REMISE, statut: 'CONFIRMEE' }]));
    render(<CommandeDetail />);
    expect(screen.getByText(/Passée à Livrée par Awa TRAORÉ/)).toBeTruthy();
    expect(screen.queryByText('Les remises sont faites par le commis du fournisseur')).toBeNull();
  });
});

describe('À réceptionner : badge « À confirmer »', () => {
  it('pastille sur les commandes qui ont une remise en attente', () => {
    h('useCommandesAReceptionner').mockReturnValue(
      lecture([
        commandeCommis({ id: 'c-1', reference: 'CMDE-1', remisesEnAttente: 2 }),
        commandeCommis({ id: 'c-2', reference: 'CMDE-2', remisesEnAttente: 0 }),
      ]),
    );
    render(<CommandesAReceptionner />);
    expect(screen.getAllByText('À confirmer')).toHaveLength(1);
    fireEvent.press(screen.getByText('CMDE-1'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/cash/commandes/c-1', expect.any(Object));
  });
});

describe('Accueil : bandeau des remises à confirmer', () => {
  it('rien sans remise', () => {
    r('useRemisesCommisAConfirmer').mockReturnValue(lecture([]));
    render(<BandeauRemisesCommis actif />);
    expect(screen.queryByText(/à confirmer/)).toBeNull();
  });

  it('une commande : ouvre son détail', () => {
    r('useRemisesCommisAConfirmer').mockReturnValue(lecture([REMISE]));
    render(<BandeauRemisesCommis actif />);
    expect(r('useRemisesCommisAConfirmer')).toHaveBeenCalledWith(true);
    fireEvent.press(screen.getByText('1 remise à confirmer'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/c-1');
  });

  it('plusieurs commandes : ouvre À réceptionner', () => {
    r('useRemisesCommisAConfirmer').mockReturnValue(lecture([REMISE, { ...REMISE, id: 'r2', commandeId: 'c-2' }]));
    render(<BandeauRemisesCommis actif />);
    fireEvent.press(screen.getByText('2 remises à confirmer'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });
});
