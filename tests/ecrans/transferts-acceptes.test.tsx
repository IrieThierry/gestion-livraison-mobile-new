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
let mockRemises: unknown[] | undefined;
jest.mock('../../features/remises-argent/hooks', () => ({
  useMesRemises: () => ({ data: mockRemises, isLoading: false, isError: false }),
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
    reference: `TRF-${id}`,
    lignes: [{ produit: { id: 'p1', designation: `Pain ${id}` }, qte: 4 }],
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
  mockRemises = undefined;
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

describe('Nouveau transfert (bon multi-produits, comme une vente)', () => {
  it('apprenti : « Rendre du stock », destinataire fixe = le principal ; envoi unique', () => {
    h.useTransfertsLivreur.mockReturnValue(lecture([tr('1')]));
    render(<NouveauTransfert />);
    expect(screen.queryByText('Choisir un apprenti')).toBeNull();
    expect(screen.getByText('Le transfert devra être accepté par Awa K.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ajouter Pain'));
    expect(screen.getByText('Lignes (1)')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Quantité Pain'), '3');
    fireEvent.changeText(screen.getByLabelText('Commentaire'), 'Trop de pain');
    expect(screen.getByText('Commentaire (facultatif)')).toBeTruthy();
    fireEvent.press(screen.getByText('Rendre'));
    fireEvent.press(screen.getByText('Rendre'));
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      { sourceId: 'A1', destinataireId: 'P1', lignes: [{ produitId: 'p1', qte: 3 }], commentaire: 'Trop de pain' },
      expect.anything(),
    );
    const opts = mutations.useEffectuerTransfert.mutate.mock.calls[0][1];
    opts.onSuccess({ reference: 'TRF-7' });
    expect(revenirApresEnregistrement).toHaveBeenCalledWith('/(livreur)/stock/transferts', null);
    expect(dialog.success).toHaveBeenCalledWith('Transfert TRF-7 envoyé', 'Le transfert devra être accepté par Awa K.');
  });

  it('principal : Envoyer plusieurs produits, le dernier ajouté en tête, triés au catalogue', () => {
    mockUser = PRINCIPAL;
    sh.useStockCourant.mockReturnValue(
      lecture([
        { produit: { id: 'p1', designation: 'Pain' }, qteVendable: 10, qteRetourneeSurPeriode: 0 },
        { produit: { id: 'p2', designation: 'Lait' }, qteVendable: 4, qteRetourneeSurPeriode: 0 },
        { produit: { id: 'p3', designation: 'Sel' }, qteVendable: 0, qteRetourneeSurPeriode: 0 },
      ]),
    );
    render(<NouveauTransfert />);
    // Catalogue : produits en stock seulement, triés par désignation.
    expect(screen.getAllByLabelText(/^Ajouter /).map((n) => n.props.accessibilityLabel)).toEqual([
      'Ajouter Lait',
      'Ajouter Pain',
    ]);
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Issa B'));
    expect(screen.getByText('Le transfert devra être accepté par Issa B.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ajouter Pain'));
    fireEvent.press(screen.getByLabelText('Ajouter Lait'));
    expect(screen.getAllByLabelText(/^Ligne /).map((n) => n.props.accessibilityLabel)).toEqual([
      'Ligne Lait',
      'Ligne Pain',
    ]);
    fireEvent.changeText(screen.getByLabelText('Quantité Pain'), '2');
    fireEvent.changeText(screen.getByLabelText('Quantité Lait'), '4');
    expect(screen.getByText('Envoyer à un apprenti')).toBeTruthy();
    fireEvent.press(screen.getByText('Envoyer'));
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      {
        sourceId: 'P1',
        destinataireId: 'A1',
        lignes: [
          { produitId: 'p2', qte: 4 },
          { produitId: 'p1', qte: 2 },
        ],
      },
      expect.anything(),
    );
  });

  it('quantité limitée au stock : ligne signalée, envoi bloqué ; retirer une ligne', () => {
    mockUser = PRINCIPAL;
    render(<NouveauTransfert />);
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Issa B'));
    fireEvent.press(screen.getByLabelText('Ajouter Pain'));
    fireEvent.changeText(screen.getByLabelText('Quantité Pain'), '11');
    expect(screen.getByText('Quantité supérieure au stock disponible (10).')).toBeTruthy();
    fireEvent.press(screen.getByText('Envoyer'));
    expect(mutations.useEffectuerTransfert.mutate).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Retirer Pain'));
    expect(screen.getByText('Lignes (0)')).toBeTruthy();
    // Bon vide : message de la spec, rien n'est envoyé.
    fireEvent.press(screen.getByText('Envoyer'));
    expect(screen.getByText('Ajoutez au moins un produit au transfert.')).toBeTruthy();
    expect(mutations.useEffectuerTransfert.mutate).not.toHaveBeenCalled();
  });

  it('principal : Reprendre du stock → source = apprenti, destinataire = moi, stock de l’apprenti', () => {
    mockUser = PRINCIPAL;
    sh.useStockActuel.mockImplementation((id: string) =>
      lecture(id === 'A2' ? [{ produit: { id: 'p9', designation: 'Lait' }, qte: 6 }] : []),
    );
    render(<NouveauTransfert />);
    // Lignes saisies en envoi : vidées au changement de mode (autre source).
    fireEvent.press(screen.getByLabelText('Ajouter Pain'));
    fireEvent.press(screen.getByText('Reprendre du stock'));
    expect(screen.getByText('Lignes (0)')).toBeTruthy();
    expect(screen.getByText('Choisis d’abord un apprenti.')).toBeTruthy();
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Moussa C'));
    expect(sh.useStockActuel).toHaveBeenLastCalledWith('A2');
    expect(screen.getByText('Le transfert devra être accepté par Moussa C.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Ajouter Lait'));
    fireEvent.changeText(screen.getByLabelText('Quantité Lait'), '7');
    expect(screen.getByText('Quantité supérieure au stock disponible (6).')).toBeTruthy();
    fireEvent.press(screen.getByText('Reprendre'));
    expect(mutations.useEffectuerTransfert.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Quantité Lait'), '6');
    fireEvent.press(screen.getByText('Reprendre'));
    expect(mutations.useEffectuerTransfert.mutate).toHaveBeenCalledWith(
      { sourceId: 'A2', destinataireId: 'P1', lignes: [{ produitId: 'p9', qte: 6 }] },
      expect.anything(),
    );
    mutations.useEffectuerTransfert.mutate.mock.calls[0][1].onSuccess();
    expect(dialog.success).toHaveBeenCalledWith('Demande de reprise envoyée', 'Le transfert devra être accepté par Moussa C.');
  });
});

describe('Bon de transfert dans les listes', () => {
  it('référence et toutes les lignes ; Accepter et Refuser portent sur le bon entier', () => {
    h.useTransfertsLivreur.mockReturnValue(
      lecture([
        tr('3', 'EN_ATTENTE', {
          lignes: [
            { produit: { id: 'p2', designation: 'Lait' }, qte: 2 },
            { produit: { id: 'p1', designation: 'Pain' }, qte: 5 },
          ] as never,
        }),
      ]),
    );
    render(<TransfertsList />);
    expect(screen.getByText('TRF-3')).toBeTruthy();
    expect(screen.getByText('Lait × 2')).toBeTruthy();
    expect(screen.getByText('Pain × 5')).toBeTruthy();
    fireEvent.press(screen.getByText('Accepter'));
    expect(dernierConfirm().message).toBe(
      'TRF-3 · 2 × Lait, 5 × Pain envoyé par Awa K : la quantité entrera dans ton stock.',
    );
    fireEvent.press(screen.getByText('Refuser'));
    expect(screen.getByText(/^TRF-3 · 2 × Lait, 5 × Pain\./)).toBeTruthy();
  });
});

describe('Libellés alignés sur le web', () => {
  it('filtres : « En attente » puis « Tous »', () => {
    mockUser = PRINCIPAL;
    h.useTransfertsParent.mockReturnValue(lecture([tr('1'), tr('2', 'ACCEPTE')]));
    render(<TransfertsList />);
    const filtres = screen.getAllByText(/^(En attente \(\d+\)|Tous)$/).map((n) => n.props.children);
    expect(filtres).toEqual(['En attente (1)', 'Tous']);
  });

  it('annulation : titre et message du web', () => {
    mockUser = PRINCIPAL;
    h.useTransfertsParent.mockReturnValue(lecture([tr('1')]));
    render(<TransfertsList />);
    fireEvent.press(screen.getByText('Annuler'));
    const c = dernierConfirm();
    expect(c.title).toBe('Annuler le transfert ?');
    expect(c.message).toBe('4 × Pain 1 vers Issa B : la quantité revient dans le stock de l’expéditeur.');
    expect(c.confirmLabel).toBe('Annuler le transfert');
    expect(c.cancelLabel).toBe('Garder');
  });

  it('commentaire : « Commentaire (facultatif) » dans chaque mode, 500 caractères au plus', () => {
    mockUser = PRINCIPAL;
    render(<NouveauTransfert />);
    expect(screen.getByText('Commentaire (facultatif)')).toBeTruthy();
    expect(screen.getByLabelText('Commentaire').props.maxLength).toBe(500);
    fireEvent.press(screen.getByText('Reprendre du stock'));
    expect(screen.getByText('Commentaire (facultatif)')).toBeTruthy();
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Issa B'));
    fireEvent.changeText(screen.getByLabelText('Commentaire'), 'x'.repeat(501));
    expect(screen.getByText('Le commentaire ne doit pas dépasser 500 caractères.')).toBeTruthy();
  });

  it('apprenti sans transfert : nom du principal lu sur ses remises', () => {
    mockRemises = [{ principal: { id: 'P1', prenom: 'Awa', nom: 'K' } }];
    render(<NouveauTransfert />);
    expect(screen.getByText('Le transfert devra être accepté par Awa K.')).toBeTruthy();
  });

  it('apprenti sans transfert ni remise : « ton livreur principal »', () => {
    render(<NouveauTransfert />);
    expect(screen.getByText('Le transfert devra être accepté par ton livreur principal.')).toBeTruthy();
  });
});

describe('Nouveau transfert : stock illisible', () => {
  it('mon stock en erreur : « Stock indisponible », pas le stock vide', () => {
    sh.useStockCourant.mockReturnValue(lecture(undefined, { isError: true, error: new Error('x') }));
    render(<NouveauTransfert />);
    expect(screen.getByText('Stock indisponible')).toBeTruthy();
    expect(screen.queryByText('Aucun produit en stock. Réceptionne d’abord une commande.')).toBeNull();
  });

  it('stock de l’apprenti en erreur (reprise) : « Stock indisponible »', () => {
    mockUser = PRINCIPAL;
    sh.useStockActuel.mockImplementation((id: string) =>
      id === 'A2' ? lecture(undefined, { isError: true, error: new Error('x') }) : lecture([]),
    );
    render(<NouveauTransfert />);
    fireEvent.press(screen.getByText('Reprendre du stock'));
    fireEvent.press(screen.getByText('Choisir un apprenti'));
    fireEvent.press(screen.getByText('Moussa C'));
    expect(screen.getByText('Stock indisponible')).toBeTruthy();
    expect(screen.queryByText('Cet apprenti n’a aucun produit en stock.')).toBeNull();
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
