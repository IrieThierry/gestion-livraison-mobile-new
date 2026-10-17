import { act, fireEvent, render, screen } from '@testing-library/react-native';
import CommandesCommis from '../../app/commis/index';
import CommandeCommis from '../../app/commis/commandes/[id]';
import RemiseCommande from '../../app/commis/commandes/remise';
import RemiseSansCommande from '../../app/commis/remise-sans-commande';
import ClientsCommis from '../../app/commis/clients/index';
import SortieClient from '../../app/commis/clients/sortie';
import RecapitulatifCommis from '../../app/commis/recapitulatif';
import MoiCommis from '../../app/commis/moi/index';
import * as hooks from '../../features/commis/hooks';
import { dialog } from '../../lib/dialog';
import { naviguer, ouvrir } from '../../lib/navigation-app';
import { jourIso } from '../../lib/periode';

let mockParams: Record<string, string> = {};
jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/commis',
  useLocalSearchParams: () => mockParams,
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
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ effective: 'light', theme: 'system', setTheme: jest.fn() }),
}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({
      user: { id: 'u1', prenom: 'Awa', nom: 'TRAORÉ', username: 'awa', profile: 'COMMIS', photoUrl: null, contact: '0701020304' },
      logout: jest.fn(),
    }),
}));
jest.mock('../../components/profil/InterrupteurBiometrie', () => ({ InterrupteurBiometrie: () => null }));
jest.mock('../../features/notifications/hooks', () => ({ useNombreNonLues: () => ({ data: 2 }) }));
jest.mock('../../features/commis/hooks', () => ({
  useCommandesCommis: jest.fn(),
  useLivreursCommis: jest.fn(),
  useCatalogueCommis: jest.fn(),
  useRemisesCommande: jest.fn(),
  useRemettre: jest.fn(),
  useRemettreSansCommande: jest.fn(),
  useAnnulerRemise: jest.fn(),
  useTerminerCommande: jest.fn(),
  useClientsCommis: jest.fn(),
  useSortiesDuJour: jest.fn(),
  useSortir: jest.fn(),
  useAnnulerSortie: jest.fn(),
  useRecapitulatifCommis: jest.fn(),
}));

const h = (n: keyof typeof hooks) => hooks[n] as unknown as jest.Mock;
const lecture = (data: unknown) => ({ data, isLoading: false, isError: false, isFetching: false, error: null, refetch: jest.fn() });
const mutation = () => ({ mutate: jest.fn(), isPending: false });

const YAO = { id: 'l1', nom: 'YAO', prenom: 'Koffi' };
const KOUA = { id: 'l2', nom: 'KOUA', prenom: 'Jean' };
const CMD = {
  id: 'c1',
  numero: 'CMDE-1',
  date: '2026-10-16T09:00:00',
  statut: 'EN_RECEPTION',
  livreur: YAO,
  lignes: [
    { produitFournisseurId: 'pf1', designation: 'Riz 25 kg', photoUrl: null, commande: 10, remisConfirme: 4, enAttente: 6 },
    { produitFournisseurId: 'pf2', designation: 'Huile 5 L', photoUrl: '/uploads/p/huile.jpg', commande: 5, remisConfirme: 0, enAttente: 0 },
  ],
  remisesEnAttente: 1,
};
const CATALOGUE = [
  { produitFournisseurId: 'pf1', produitId: 'p1', designation: 'Riz 25 kg', photoUrl: null },
  { produitFournisseurId: 'pf2', produitId: 'p2', designation: 'Huile 5 L', photoUrl: '/uploads/p/huile.jpg' },
  { produitFournisseurId: 'pf3', produitId: 'p3', designation: 'Sucre 1 kg', photoUrl: null },
];
const remise = (over: Record<string, unknown>) => ({
  id: 'r1',
  commandeId: 'c1',
  commandeNumero: 'CMDE-1',
  livreur: YAO,
  commis: { id: 'u1', nom: 'TRAORÉ', prenom: 'Awa' },
  statut: 'EN_ATTENTE',
  lignes: [{ produitFournisseurId: 'pf1', designation: 'Riz 25 kg', photoUrl: null, quantite: 6 }],
  creeLe: '2026-10-17T10:30:00',
  reponduLe: null,
  motif: null,
  ...over,
});

let m: Record<string, ReturnType<typeof mutation>>;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  m = {};
  for (const n of ['useRemettre', 'useRemettreSansCommande', 'useAnnulerRemise', 'useTerminerCommande', 'useSortir', 'useAnnulerSortie'] as const) {
    m[n] = mutation();
    h(n).mockReturnValue(m[n]);
  }
  h('useCommandesCommis').mockReturnValue(lecture([CMD]));
  h('useLivreursCommis').mockReturnValue(lecture([YAO, KOUA]));
  h('useCatalogueCommis').mockReturnValue(lecture(CATALOGUE));
  h('useRemisesCommande').mockReturnValue(lecture([]));
  h('useClientsCommis').mockReturnValue(lecture([{ id: 'k1', nom: 'BOUTIQUE AWA' }]));
  h('useSortiesDuJour').mockReturnValue(lecture([]));
  h('useRecapitulatifCommis').mockReturnValue(lecture({ produits: [], enAttente: [], refusees: [] }));
});

/** Dernier dialogue de confirmation ouvert. */
const confirmation = () => {
  const calls = (dialog.confirm as jest.Mock).mock.calls;
  return calls[calls.length - 1][0];
};

describe('Commandes du commis', () => {
  it('liste : commandé / remis / en attente par produit, sans aucun prix ni montant', () => {
    render(<CommandesCommis />);
    expect(screen.getByText('CMDE-1')).toBeTruthy();
    // Le livreur de la commande (et sa pastille de filtre).
    expect(screen.getAllByText('Koffi YAO')).toHaveLength(2);
    expect(screen.getByText('1 remise en attente de confirmation')).toBeTruthy();
    expect(screen.getByLabelText('Riz 25 kg : commandé 10, remis 4, en attente 6')).toBeTruthy();
    expect(screen.getByLabelText('Huile 5 L : commandé 5, remis 0, en attente 0')).toBeTruthy();
    expect(screen.queryByText(/F$|FCFA|prix|montant/i)).toBeNull();
    fireEvent.press(screen.getByLabelText('Ouvrir la commande CMDE-1'));
    expect(naviguer).toHaveBeenCalledWith('/commis/commandes/c1');
    fireEvent.press(screen.getByLabelText('Remise sans commande'));
    expect(naviguer).toHaveBeenCalledWith('/commis/remise-sans-commande');
  });

  it('filtre par livreur', () => {
    render(<CommandesCommis />);
    expect(h('useCommandesCommis')).toHaveBeenLastCalledWith(undefined);
    fireEvent.press(screen.getByLabelText('Filtrer : Jean KOUA'));
    expect(h('useCommandesCommis')).toHaveBeenLastCalledWith('l2');
    fireEvent.press(screen.getByLabelText('Filtrer : Tous les livreurs'));
    expect(h('useCommandesCommis')).toHaveBeenLastCalledWith(undefined);
  });
});

describe('Détail d’une commande (commis)', () => {
  beforeEach(() => {
    mockParams = { id: 'c1' };
  });

  it('remise en attente : « En attente de confirmation » et Annuler (confirmation, un seul envoi)', () => {
    h('useRemisesCommande').mockReturnValue(lecture([remise({})]));
    render(<CommandeCommis />);
    expect(screen.getByText('En attente de confirmation')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Annuler la remise du 17/10/2026 10:30'));
    const c = confirmation();
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(m.useAnnulerRemise.mutate).toHaveBeenCalledTimes(1);
    expect(m.useAnnulerRemise.mutate.mock.calls[0][0]).toBe('r1');
  });

  it('remise refusée (notification REMISE_COMMIS_REFUSEE) : le motif est affiché, pas d’Annuler', () => {
    h('useRemisesCommande').mockReturnValue(lecture([remise({ statut: 'REFUSEE', motif: 'Il manque 2 sacs', reponduLe: '2026-10-17T11:00:00' })]));
    render(<CommandeCommis />);
    expect(screen.getByText('Refusée')).toBeTruthy();
    expect(screen.getByText('Motif : Il manque 2 sacs')).toBeTruthy();
    expect(screen.queryByLabelText(/Annuler la remise/)).toBeNull();
  });

  it('Nouvelle remise ouvre la saisie de la commande', () => {
    render(<CommandeCommis />);
    expect(screen.getByLabelText('Riz 25 kg : commandé 10, remis 4, en attente 6')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Nouvelle remise'));
    expect(naviguer).toHaveBeenCalledWith('/commis/commandes/remise', { commandeId: 'c1' });
  });

  it('« Commande terminée » : confirmation puis un seul POST ; message 400 du serveur affiché tel quel', () => {
    render(<CommandeCommis />);
    fireEvent.press(screen.getByLabelText('Commande terminée'));
    const c = confirmation();
    expect(c.title).toBe('Commande terminée ?');
    expect(m.useTerminerCommande.mutate).not.toHaveBeenCalled();
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(m.useTerminerCommande.mutate).toHaveBeenCalledTimes(1);
    const [id, opts] = m.useTerminerCommande.mutate.mock.calls[0];
    expect(id).toBe('c1');
    act(() => opts.onError({ response: { status: 400, data: { message: 'Une remise attend encore la confirmation du livreur.' } } }));
    expect(dialog.error).toHaveBeenCalledWith('Action impossible', 'Une remise attend encore la confirmation du livreur.');
    act(() => {
      opts.onSuccess();
      opts.onSettled();
    });
    expect(dialog.success).toHaveBeenCalled();
    expect(ouvrir).toHaveBeenCalledWith('/commis');
  });
});

describe('Saisie d’une remise sur une commande', () => {
  beforeEach(() => {
    mockParams = { commandeId: 'c1' };
  });

  it('rien de saisi → Envoyer désactivé', () => {
    render(<RemiseCommande />);
    fireEvent.press(screen.getByLabelText('Envoyer la remise'));
    expect(dialog.confirm).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Quantité Riz 25 kg'), '0');
    fireEvent.press(screen.getByLabelText('Envoyer la remise'));
    expect(dialog.confirm).not.toHaveBeenCalled();
  });

  it('quantité au-delà du commandé, produit hors commande, 0 ignoré → confirmation résumée puis POST exact, une seule fois', () => {
    render(<RemiseCommande />);
    expect(screen.getByLabelText('Riz 25 kg : commandé 10, remis 4, en attente 6')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Quantité Riz 25 kg'), '12');
    fireEvent.changeText(screen.getByLabelText('Quantité Huile 5 L'), '0');
    fireEvent.press(screen.getByLabelText('Ajouter un produit'));
    fireEvent.press(screen.getByLabelText('Ajouter Sucre 1 kg'));
    fireEvent.changeText(screen.getByLabelText('Quantité Sucre 1 kg'), '3');
    fireEvent.press(screen.getByLabelText('Envoyer la remise'));
    const c = confirmation();
    expect(c.message).toContain('12 × Riz 25 kg\n3 × Sucre 1 kg');
    expect(c.message).not.toContain('Huile');
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(m.useRemettre.mutate).toHaveBeenCalledTimes(1);
    expect(m.useRemettre.mutate.mock.calls[0][0]).toEqual({
      commandeId: 'c1',
      lignes: [
        { produitFournisseurId: 'pf1', quantite: 12 },
        { produitFournisseurId: 'pf3', quantite: 3 },
      ],
    });
  });
});

describe('Remise sans commande', () => {
  it('choix d’un livreur titulaire puis des produits → POST exact', () => {
    render(<RemiseSansCommande />);
    fireEvent.press(screen.getByLabelText('Ajouter un produit'));
    fireEvent.press(screen.getByLabelText('Ajouter Huile 5 L'));
    fireEvent.changeText(screen.getByLabelText('Quantité Huile 5 L'), '4');
    // Sans livreur : rien n'est envoyé.
    fireEvent.press(screen.getByLabelText('Envoyer la remise'));
    expect(dialog.confirm).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Choisir Jean KOUA'));
    fireEvent.press(screen.getByLabelText('Envoyer la remise'));
    const c = confirmation();
    expect(c.message).toContain('Jean KOUA');
    expect(c.message).toContain('4 × Huile 5 L');
    act(() => c.onConfirm());
    expect(m.useRemettreSansCommande.mutate.mock.calls[0][0]).toEqual({
      livreurId: 'l2',
      lignes: [{ produitFournisseurId: 'pf2', quantite: 4 }],
    });
    act(() => m.useRemettreSansCommande.mutate.mock.calls[0][1].onSuccess({ commandeId: 'c9' }));
    expect(ouvrir).toHaveBeenCalledWith('/commis/commandes/c9');
  });
});

describe('Clients du commis : sorties', () => {
  it('sortie client : client, produits → POST exact', () => {
    mockParams = { clientId: 'k1' };
    render(<SortieClient />);
    fireEvent.press(screen.getByLabelText('Ajouter un produit'));
    fireEvent.press(screen.getByLabelText('Ajouter Riz 25 kg'));
    fireEvent.changeText(screen.getByLabelText('Quantité Riz 25 kg'), '2');
    fireEvent.press(screen.getByLabelText('Enregistrer la sortie'));
    const c = confirmation();
    expect(c.message).toContain('BOUTIQUE AWA');
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(m.useSortir.mutate).toHaveBeenCalledTimes(1);
    expect(m.useSortir.mutate.mock.calls[0][0]).toEqual({ clientId: 'k1', lignes: [{ produitFournisseurId: 'pf1', quantite: 2 }] });
  });

  it('sorties du jour : Annuler (confirmation), message du serveur si refusé', () => {
    h('useSortiesDuJour').mockReturnValue(
      lecture([
        {
          id: 's1',
          client: { id: 'k1', nom: 'BOUTIQUE AWA' },
          date: jourIso(new Date()),
          creeLe: '2026-10-17T08:15:00',
          auteur: { id: 'u1', nom: 'TRAORÉ', prenom: 'Awa' },
          annulee: false,
          annuleeLe: null,
          lignes: [{ produitFournisseurId: 'pf1', designation: 'Riz 25 kg', photoUrl: null, quantite: 2 }],
        },
      ]),
    );
    render(<ClientsCommis />);
    expect(h('useSortiesDuJour')).toHaveBeenCalledWith(jourIso(new Date()));
    fireEvent.press(screen.getByLabelText('Nouvelle sortie pour BOUTIQUE AWA'));
    expect(naviguer).toHaveBeenCalledWith('/commis/clients/sortie', { clientId: 'k1' });
    fireEvent.press(screen.getByLabelText('Annuler la sortie de BOUTIQUE AWA (08:15)'));
    act(() => confirmation().onConfirm());
    const [id, opts] = m.useAnnulerSortie.mutate.mock.calls[0];
    expect(id).toBe('s1');
    act(() => opts.onError({ response: { status: 400, data: { message: 'Seul le fournisseur peut annuler une sortie d’un jour passé.' } } }));
    expect(dialog.error).toHaveBeenCalledWith('Annulation impossible', 'Seul le fournisseur peut annuler une sortie d’un jour passé.');
  });
});

describe('Récapitulatif du commis', () => {
  it('récap du jour : quantités par livreur et par client, en attente et refusées à part', () => {
    h('useRecapitulatifCommis').mockReturnValue(
      lecture({
        produits: [
          {
            produitFournisseurId: 'pf1',
            designation: 'Riz 25 kg',
            photoUrl: null,
            totalConfirme: 10,
            totalClients: 2,
            parLivreur: [{ livreurId: 'l1', nom: 'Koffi YAO', quantite: 10 }],
            parClient: [{ clientId: 'k1', nom: 'BOUTIQUE AWA', quantite: 2 }],
          },
        ],
        enAttente: [remise({})],
        refusees: [remise({ id: 'r2', statut: 'REFUSEE', motif: 'Sacs abîmés' })],
      }),
    );
    render(<RecapitulatifCommis />);
    expect(h('useRecapitulatifCommis')).toHaveBeenCalledWith(jourIso(new Date()));
    expect(screen.getByLabelText('Total remis aux livreurs : Riz 25 kg').props.children).toBe(10);
    expect(screen.getByLabelText('Total sorti aux clients : Riz 25 kg').props.children).toBe(2);
    expect(screen.getByText('Koffi YAO : 10')).toBeTruthy();
    expect(screen.getByText('BOUTIQUE AWA : 2')).toBeTruthy();
    expect(screen.getByText('En attente (1)')).toBeTruthy();
    expect(screen.getByText('Refusées (1)')).toBeTruthy();
    expect(screen.getByText('Motif : Sacs abîmés')).toBeTruthy();
  });
});

describe('Moi (commis)', () => {
  it('compte, mot de passe, notifications', () => {
    render(<MoiCommis />);
    expect(screen.getByText('awa · Commis')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Changer le mot de passe'));
    expect(naviguer).toHaveBeenCalledWith('/commis/moi/password');
    fireEvent.press(screen.getByLabelText('Notifications'));
    expect(ouvrir).toHaveBeenCalledWith('/commis/notifications');
  });
});
