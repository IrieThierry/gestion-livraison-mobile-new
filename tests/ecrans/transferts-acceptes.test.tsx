import { fireEvent, render, screen } from '@testing-library/react-native';
import TransfertsList from '../../app/(livreur)/stock/transferts/index';
import NouveauTransfert from '../../app/(livreur)/stock/transferts/nouveau';
import StockCourant from '../../app/(livreur)/stock/index';
import { dialog } from '../../lib/dialog';
import { naviguer, revenirApresEnregistrement } from '../../lib/navigation-app';
import * as hooks from '../../features/transferts/hooks';
import * as stockHooks from '../../features/stock/hooks';
import type { StatutTransfert, TransfertStockResponse } from '../../types/api';

jest.mock('expo-router', () => ({
  usePathname: () => '/stock/transferts',
  useLocalSearchParams: () => ({}),
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
const PRINCIPAL = { id: 'P1', prenom: 'Awa', nom: 'K', parentId: null };
const APPRENTI = { id: 'A1', prenom: 'Issa', nom: 'B', parentId: 'P1' };
let mockUser: Record<string, unknown> = APPRENTI;
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../features/transferts/hooks', () => ({
  useTransfertsLivreur: jest.fn(),
  useTransfertsParent: jest.fn(),
  useTransfertsADecider: jest.fn(),
  useEffectuerTransfert: jest.fn(),
  useAccepterTransfert: jest.fn(),
  useRefuserTransfert: jest.fn(),
  useAnnulerTransfert: jest.fn(),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: jest.fn(),
  useStockActuel: jest.fn(),
  useStockEnTransit: jest.fn(),
}));
jest.mock('../../features/apprentis/hooks', () => ({
  useApprentis: () => ({
    data: [
      { id: 'A1', prenom: 'Issa', nom: 'B', actif: true },
      { id: 'A2', prenom: 'Moussa', nom: 'C', actif: true },
    ],
    isLoading: false,
  }),
}));
jest.mock('../../components/livreur/MiseAZeroDialog', () => ({ MiseAZeroDialog: () => null }));

const h = hooks as unknown as Record<string, jest.Mock>;
const sh = stockHooks as unknown as Record<string, jest.Mock>;
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  refetch: jest.fn(),
  ...etat,
});
const mutations: Record<string, { mutate: jest.Mock; isPending: boolean }> = {};

const tr = (id: string, statut: StatutTransfert = 'EN_ATTENTE', extra: Partial<TransfertStockResponse> = {}) =>
  ({
    id,
    source: { id: 'P1', prenom: 'Awa', nom: 'K' },
    destinataire: { id: 'A1', prenom: 'Issa', nom: 'B' },
    produit: { id: 'p1', designation: `Pain ${id}` },
    qte: 4,
    dateTransfert: '2026-10-12T10:00:00',
    commentaire: null,
    statut,
    motifRefus: null,
    initieParId: 'P1',
    decideParId: null,
    dateDecision: null,
    reprise: false,
    decideurId: 'A1',
    ...extra,
  }) as TransfertStockResponse;

const dernierConfirm = () => {
  const appels = (dialog.confirm as jest.Mock).mock.calls;
  return appels[appels.length - 1][0];
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = APPRENTI;
  for (const n of ['useEffectuerTransfert', 'useAccepterTransfert', 'useRefuserTransfert', 'useAnnulerTransfert']) {
    mutations[n] = { mutate: jest.fn(), isPending: false };
    h[n].mockReturnValue(mutations[n]);
  }
  h.useTransfertsLivreur.mockReturnValue(lecture([]));
  h.useTransfertsParent.mockReturnValue(lecture([]));
  h.useTransfertsADecider.mockReturnValue(lecture([]));
  sh.useStockCourant.mockReturnValue(
    lecture([{ produit: { id: 'p1', designation: 'Pain' }, qteVendable: 10, qteRetourneeSurPeriode: 0 }]),
  );
  sh.useStockActuel.mockReturnValue(lecture([]));
  sh.useStockEnTransit.mockReturnValue(lecture({ lignes: [] }));
});

describe('Transferts : actions selon le rôle', () => {
  it('apprenti : sa liste ; décideur → Accepter, Refuser ; initiateur → Annuler ; statuts', () => {
    h.useTransfertsLivreur.mockReturnValue(
      lecture([
        tr('1'),
        tr('2', 'EN_ATTENTE', {
          source: { id: 'A1', prenom: 'Issa', nom: 'B' } as never,
          destinataire: { id: 'P1', prenom: 'Awa', nom: 'K' } as never,
          initieParId: 'A1',
          decideurId: 'P1',
        }),
        tr('3', 'REFUSE', { motifRefus: 'Pas commandé' }),
        tr('4', 'ACCEPTE'),
      ]),
    );
    render(<TransfertsList />);
    expect(h.useTransfertsLivreur).toHaveBeenCalledWith('A1');
    expect(h.useTransfertsParent).toHaveBeenCalledWith(undefined);
    expect(screen.getAllByText('En attente').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Refusé')).toBeTruthy();
    expect(screen.getByText('Accepté')).toBeTruthy();
    expect(screen.getByText('Motif : Pas commandé')).toBeTruthy();
    expect(screen.getAllByText('Accepter')).toHaveLength(1);
    expect(screen.getAllByText('Refuser')).toHaveLength(1);
    expect(screen.getAllByText('Annuler')).toHaveLength(1);
    // Apprenti : bouton « Rendre du stock ».
    fireEvent.press(screen.getByText('Rendre du stock'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/stock/transferts/nouveau');
  });

  it('principal : liste de l’équipe ; filtre « En attente »', () => {
    mockUser = PRINCIPAL;
    h.useTransfertsParent.mockReturnValue(lecture([tr('1'), tr('2', 'ACCEPTE')]));
    render(<TransfertsList />);
    expect(h.useTransfertsParent).toHaveBeenCalledWith('P1');
    expect(screen.getByText(/Pain 2 ×/)).toBeTruthy();
    // Initiateur de l'envoi en attente : Annuler ; jamais Accepter.
    expect(screen.getByText('Annuler')).toBeTruthy();
    expect(screen.queryByText('Accepter')).toBeNull();
    fireEvent.press(screen.getByText('En attente (1)'));
    expect(screen.queryByText(/Pain 2 ×/)).toBeNull();
    expect(screen.getByText(/Pain 1 ×/)).toBeTruthy();
  });

  it('Accepter : confirmation puis un seul envoi', () => {
    h.useTransfertsLivreur.mockReturnValue(lecture([tr('1')]));
    render(<TransfertsList />);
    fireEvent.press(screen.getByText('Accepter'));
    const c = dernierConfirm();
    c.onConfirm();
    c.onConfirm();
    expect(mutations.useAccepterTransfert.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useAccepterTransfert.mutate).toHaveBeenCalledWith('1', expect.anything());
  });

  it('Refuser sans motif : message, rien n’est envoyé ; avec motif : envoyé', () => {
    h.useTransfertsLivreur.mockReturnValue(lecture([tr('1')]));
    render(<TransfertsList />);
    fireEvent.press(screen.getByText('Refuser'));
    expect(screen.getByText('Refuser le transfert')).toBeTruthy();
    const boutons = () => screen.getAllByText('Refuser');
    fireEvent.press(boutons()[boutons().length - 1]);
    expect(screen.getByText('Précisez le motif du refus.')).toBeTruthy();
    expect(mutations.useRefuserTransfert.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Motif du refus'), '  Pas commandé ');
    fireEvent.press(boutons()[boutons().length - 1]);
    expect(mutations.useRefuserTransfert.mutate).toHaveBeenCalledWith(
      { id: '1', motif: 'Pas commandé' },
      expect.anything(),
    );
  });

  it('Annuler : confirmation puis envoi', () => {
    mockUser = PRINCIPAL;
    h.useTransfertsParent.mockReturnValue(lecture([tr('1')]));
    render(<TransfertsList />);
    fireEvent.press(screen.getByText('Annuler'));
    dernierConfirm().onConfirm();
    expect(mutations.useAnnulerTransfert.mutate).toHaveBeenCalledWith('1', expect.anything());
  });

  it('erreur de lecture distincte de la liste vide', () => {
    h.useTransfertsLivreur.mockReturnValue(lecture(undefined, { isError: true }));
    render(<TransfertsList />);
    expect(screen.getByText('Transferts indisponibles')).toBeTruthy();
    expect(screen.queryByText('Aucun transfert')).toBeNull();
  });
});

describe('Nouveau transfert', () => {
  it('apprenti : « Rendre du stock », destinataire fixe = le principal', () => {
    h.useTransfertsLivreur.mockReturnValue(lecture([tr('1')]));
    render(<NouveauTransfert />);
    expect(screen.queryByText('Choisir un apprenti')).toBeNull();
    expect(screen.getByText('Le transfert devra être accepté par Awa K.')).toBeTruthy();
    fireEvent.press(screen.getByText('Choisir un produit'));
    fireEvent.press(screen.getByText('Pain · stock 10'));
    fireEvent.changeText(screen.getByLabelText('Quantité'), '3');
    fireEvent.changeText(screen.getByLabelText('Motif'), 'Trop de pain');
    const boutons = screen.getAllByText('Rendre du stock');
    fireEvent.press(boutons[boutons.length - 1]);
    fireEvent.press(boutons[boutons.length - 1]);
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      { sourceId: 'A1', destinataireId: 'P1', produitId: 'p1', qte: 3, commentaire: 'Trop de pain' },
      expect.anything(),
    );
    const opts = mutations.useEffectuerTransfert.mutate.mock.calls[0][1];
    opts.onSuccess();
    expect(revenirApresEnregistrement).toHaveBeenCalledWith('/(livreur)/stock/transferts', null);
  });

  it('principal : Reprendre du stock → source = apprenti, destinataire = moi, stock de l’apprenti', () => {
    mockUser = PRINCIPAL;
    sh.useStockActuel.mockImplementation((id: string) =>
      lecture(id === 'A2' ? [{ produit: { id: 'p9', designation: 'Lait' }, qte: 6 }] : []),
    );
    render(<NouveauTransfert />);
    fireEvent.press(screen.getByText('Reprendre du stock'));
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Moussa C'));
    expect(sh.useStockActuel).toHaveBeenLastCalledWith('A2');
    expect(screen.getByText('Le transfert devra être accepté par Moussa C.')).toBeTruthy();
    fireEvent.press(screen.getByText('Choisir un produit'));
    fireEvent.press(screen.getByText('Lait · stock 6'));
    fireEvent.changeText(screen.getByLabelText('Quantité'), '7');
    const boutons = () => screen.getAllByText('Reprendre du stock');
    fireEvent.press(boutons()[boutons().length - 1]);
    expect(mutations.useEffectuerTransfert.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Quantité'), '6');
    fireEvent.press(boutons()[boutons().length - 1]);
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      { sourceId: 'A2', destinataireId: 'P1', produitId: 'p9', qte: 6 },
      expect.anything(),
    );
  });

  it('principal : Envoyer → source = moi, destinataire = l’apprenti', () => {
    mockUser = PRINCIPAL;
    render(<NouveauTransfert />);
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Issa B'));
    expect(screen.getByText('Le transfert devra être accepté par Issa B.')).toBeTruthy();
    fireEvent.press(screen.getByText('Choisir un produit'));
    fireEvent.press(screen.getByText('Pain · stock 10'));
    fireEvent.changeText(screen.getByLabelText('Quantité'), '2');
    fireEvent.press(screen.getByText('Envoyer le transfert'));
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      { sourceId: 'P1', destinataireId: 'A1', produitId: 'p1', qte: 2 },
      expect.anything(),
    );
  });
});

describe('Écran Stock', () => {
  it('apprenti : « Rendre du stock » et « Transferts », pas « Stock équipe »', () => {
    render(<StockCourant />);
    fireEvent.press(screen.getByText('Rendre du stock'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/stock/transferts/nouveau');
    fireEvent.press(screen.getByText('Transferts'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/stock/transferts');
    expect(screen.queryByText('Stock équipe')).toBeNull();
  });

  it('principal : pas de « Rendre du stock »', () => {
    mockUser = PRINCIPAL;
    render(<StockCourant />);
    expect(screen.queryByText('Rendre du stock')).toBeNull();
    expect(screen.getByText('Stock équipe')).toBeTruthy();
  });

  it('bloc « En transit » : sortant et entrant par produit ; absent sans transit', () => {
    sh.useStockEnTransit.mockReturnValue(
      lecture({
        lignes: [
          { produit: { id: 'p1', designation: 'Pain' }, sortant: 4, entrant: 0 },
          { produit: { id: 'p2', designation: 'Lait' }, sortant: 0, entrant: 2 },
        ],
      }),
    );
    const { unmount } = render(<StockCourant />);
    expect(sh.useStockEnTransit).toHaveBeenCalledWith('A1');
    expect(screen.getByText('En transit')).toBeTruthy();
    expect(screen.getByText('4 envoyé(s), en attente d’acceptation')).toBeTruthy();
    expect(screen.getByText('2 à recevoir')).toBeTruthy();
    unmount();
    sh.useStockEnTransit.mockReturnValue(lecture({ lignes: [] }));
    render(<StockCourant />);
    expect(screen.queryByText('En transit')).toBeNull();
  });
});
