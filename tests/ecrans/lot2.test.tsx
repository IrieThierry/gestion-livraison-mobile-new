import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { naviguer, ouvrir, retourParent, revenirApresEnregistrement } from '../../lib/navigation-app';
import { PageHeader } from '../../components/shared/PageHeader';
import MesEncaissements from '../../app/(livreur)/cash/encaissements';
import RetoursList from '../../app/(livreur)/cash/retours';
import ReversementsHistorique from '../../app/(livreur)/cash/reversements/historique';
import NouveauReversement from '../../app/(livreur)/cash/reversements/nouveau';
import { useEncaissementsByLivreur } from '../../features/encaissements/hooks';
import { useRetours } from '../../features/retours/hooks';
import { useReversementsListe, useEnregistrerReversement } from '../../features/reversements/hooks';
import { useDialogStore } from '../../stores/dialogStore';
import { partagerRecu } from '../../features/reversements/partageRecu';
import { chargerDetailRecu } from '../../features/reversements/recuDonnees';
import { useRecuStore } from '../../stores/recuStore';
import { PreparationRecuBanner } from '../../components/shared/PreparationRecuBanner';

jest.mock('expo-router', () => ({
  usePathname: () => '/cash/encaissements',
  useLocalSearchParams: () => ({ type: 'CLIENT', beneficiaireId: 'c1', label: 'Marie Kouassi', mois: '10', annee: '2026' }),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
}));
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  revenirApresEnregistrement: jest.fn(),
  origineDe: jest.fn(() => null),
  retourParent: jest.fn(),
}));
jest.mock('../../stores/authStore', () => {
  const user = { id: 'liv-1', prenom: 'Ahmed', nom: 'Koné', parentId: null };
  const useAuthStore = (sel: (s: unknown) => unknown) => sel({ user });
  useAuthStore.getState = () => ({ user });
  return { useAuthStore };
});
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: true }),
}));
const lecture = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  isRefetching: false,
  error: null,
  refetch: jest.fn(),
});
jest.mock('../../features/encaissements/hooks', () => ({ useEncaissementsByLivreur: jest.fn() }));
jest.mock('../../features/retours/hooks', () => ({ useRetours: jest.fn() }));
jest.mock('../../features/retours/api', () => ({ moisEnCours: () => ({}), derniersJours: () => ({}) }));
jest.mock('../../features/clients/hooks', () => ({
  useClientsByLivreur: () => ({ data: [{ id: 'c1', prenom: 'Marie', nom: 'Kouassi' }], isLoading: false }),
  useEncoursByLivreur: () => ({ data: [] }),
}));
jest.mock('../../features/produits/hooks', () => ({ useProduits: () => ({ data: [] }) }));
jest.mock('../../features/apprentis/hooks', () => ({ useApprentis: () => ({ data: [] }) }));
jest.mock('../../features/lookups/hooks', () => ({ useFournisseurs: () => ({ data: [{ id: 'f1', libelle: 'Soleil' }] }) }));
jest.mock('../../features/reversements/hooks', () => ({
  useReversementsListe: jest.fn(),
  useEnregistrerReversement: jest.fn(),
}));
jest.mock('../../features/reversements/partageRecu', () => ({ partagerRecu: jest.fn(() => Promise.resolve('uri')) }));
const DETAIL = { type: 'client', lignes: [], totaux: { qteVendue: 0, qteRetournee: 0, qteNette: 0, montant: 0, remise: 0 } };
jest.mock('../../features/reversements/recuDonnees', () => ({ chargerDetailRecu: jest.fn() }));

const reversement = {
  id: 'rev-1',
  type: 'CLIENT',
  beneficiaireId: 'c1',
  livreurId: 'liv-1',
  montant: 300,
  periodeMois: 10,
  periodeAnnee: 2026,
  dateReversement: '2026-10-08T00:00:00',
  commentaire: null,
  informatif: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  useDialogStore.getState().hide?.();
  (chargerDetailRecu as jest.Mock).mockResolvedValue(DETAIL);
});

describe('PageHeader : flèche retour = parent logique', () => {
  it('appelle retourParent avec l’écran courant', () => {
    render(<PageHeader title="X" />);
    fireEvent.press(screen.getByLabelText('Retour'));
    expect(retourParent).toHaveBeenCalledWith('/cash/encaissements');
  });
});

describe('Mes encaissements', () => {
  const enc = (reference: string, date: string, montant: number, prenom: string) => ({
    id: reference,
    reference,
    dateEncaissement: date,
    montantEncaisse: montant,
    client: { prenom, nom: 'K' },
    commentaire: null,
    livraisons: [],
  });

  /** Jour local il y a `n` jours, à 9 h (`yyyy-MM-ddT09:00:00`). */
  const ilYa = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const j = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${j}T09:00:00`;
  };

  it('liste récente d’abord, total, recherche, bouton Encaisser → livraisons', () => {
    (useEncaissementsByLivreur as jest.Mock).mockReturnValue(
      lecture([enc('ENC-1', ilYa(3), 1000, 'Awa'), enc('ENC-2', ilYa(1), 3600, 'Jean')]),
    );
    render(<MesEncaissements />);
    expect(screen.getByText('Mes encaissements')).toBeTruthy();
    expect(screen.getByLabelText(/^Total : 4\s600 FCFA$/)).toBeTruthy();
    const noms = screen.getAllByText(/^(Awa|Jean) K$/).map((n) => n.props.children);
    expect(noms).toEqual(['Jean K', 'Awa K']);
    fireEvent.changeText(screen.getByPlaceholderText('Client, référence…'), 'awa');
    expect(screen.getByLabelText(/^Total : 1\s000 FCFA$/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Encaisser'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/livraisons');
  });

  it('période : 7 j par défaut, la liste et le total suivent la période (P6)', () => {
    (useEncaissementsByLivreur as jest.Mock).mockReturnValue(
      lecture([
        enc('ENC-1', ilYa(0), 1000, 'Awa'),
        enc('ENC-2', ilYa(3), 2000, 'Jean'),
        enc('ENC-3', ilYa(20), 4000, 'Marc'),
      ]),
    );
    render(<MesEncaissements />);
    // 7 j par défaut : l'encaissement d'il y a 20 jours est hors période.
    expect(screen.getByLabelText('7 j').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByLabelText(/^Total : 3\s000 FCFA$/)).toBeTruthy();
    expect(screen.queryByText('Marc K')).toBeNull();
    fireEvent.press(screen.getByLabelText('30 j'));
    expect(screen.getByLabelText(/^Total : 7\s000 FCFA$/)).toBeTruthy();
    expect(screen.getByText('Marc K')).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Aujourd'hui"));
    expect(screen.getByLabelText(/^Total : 1\s000 FCFA$/)).toBeTruthy();
    expect(screen.queryByText('Jean K')).toBeNull();
  });

  it('aucun encaissement sur la période : message distinct de l’état vide', () => {
    (useEncaissementsByLivreur as jest.Mock).mockReturnValue(lecture([enc('ENC-3', ilYa(20), 4000, 'Marc')]));
    render(<MesEncaissements />);
    expect(screen.getByText('Aucun encaissement sur cette période.')).toBeTruthy();
    expect(screen.queryByText('Aucun encaissement')).toBeNull();
  });

  it('état vide', () => {
    (useEncaissementsByLivreur as jest.Mock).mockReturnValue(lecture([]));
    render(<MesEncaissements />);
    expect(screen.getByText('Aucun encaissement')).toBeTruthy();
  });
});

describe('Retours produits : total par produit', () => {
  const retour = (id: string, produit: string, quantite: number, remisEnStock = true) => ({
    id,
    dateRetour: '2026-10-02T09:00:00',
    client: { id: 'c1', nom: 'Marie' },
    livraison: { id: 'l1', reference: 'LIV-1', date: '2026-10-02' },
    produit: { id: produit, designation: produit },
    quantite,
    remisEnStock,
    origine: 'MENU_RETOURS',
    livreur: { id: 'liv-1', nom: 'Ahmed' },
    auteur: { id: 'liv-1', nom: 'Ahmed' },
    valeur: 100,
  });
  const pages = (contenu: unknown[]) => ({
    ...lecture({ pages: [{ contenu, total: contenu.length, page: 0, taille: 50 }] }),
    hasNextPage: false,
    isFetchingNextPage: false,
  });

  it('bloc au-dessus de la liste, suit la recherche, absent si la liste est vide', () => {
    (useRetours as jest.Mock).mockReturnValue(
      pages([retour('1', 'Pain', 3), retour('2', 'Pain', 2, false), retour('3', 'Lait', 1)]),
    );
    render(<RetoursList />);
    expect(screen.getByText('Total par produit')).toBeTruthy();
    expect(screen.getByLabelText('Quantité retournée Pain : 5')).toBeTruthy();
    expect(screen.getByText('Remis en stock 3 · Perdu 2')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Client, produit, réf. livraison…'), 'lait');
    expect(screen.queryByLabelText('Quantité retournée Pain : 5')).toBeNull();
    expect(screen.getByLabelText('Quantité retournée Lait : 1')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Client, produit, réf. livraison…'), 'zzz');
    expect(screen.queryByText('Total par produit')).toBeNull();
  });
});

describe('Reçu de reversement', () => {
  it('historique : bouton « Reçu » sur chaque ligne', async () => {
    (useReversementsListe as jest.Mock).mockReturnValue(lecture([reversement]));
    render(<ReversementsHistorique />);
    fireEvent.press(screen.getByLabelText('Partager le reçu'));
    await waitFor(() => expect(partagerRecu).toHaveBeenCalled());
    expect(partagerRecu).toHaveBeenCalledWith(
      expect.objectContaining({
        nomFichier: 'Recu-reversement_Marie-Kouassi_2026-10-08.pdf',
        beneficiaire: { nom: 'Marie Kouassi', qualite: 'Client' },
        payeur: { nom: 'Ahmed Koné', qualite: 'Livreur' },
        detail: DETAIL,
      }),
    );
    // Détail lu pour le livreur connecté (livreur principal).
    expect(chargerDetailRecu).toHaveBeenCalledWith(reversement, { id: 'liv-1', parentId: null });
    expect(useDialogStore.getState().open).toBe(false);
  });

  it('pendant la lecture du détail : bandeau « Préparation du reçu… » et bouton occupé', async () => {
    let finir: (v: unknown) => void = () => undefined;
    (chargerDetailRecu as jest.Mock).mockReturnValue(new Promise((ok) => (finir = ok)));
    (useReversementsListe as jest.Mock).mockReturnValue(lecture([reversement]));
    render(
      <>
        <PreparationRecuBanner />
        <ReversementsHistorique />
      </>,
    );
    expect(screen.queryByLabelText('Préparation du reçu…')).toBeNull();
    fireEvent.press(screen.getByLabelText('Partager le reçu'));
    expect(useRecuStore.getState().preparation).toBe('rev-1');
    expect(screen.getByLabelText('Préparation du reçu…')).toBeTruthy();
    expect(screen.getByLabelText('Partager le reçu').props.accessibilityState).toMatchObject({ busy: true });
    await act(async () => finir(DETAIL));
    await waitFor(() => expect(partagerRecu).toHaveBeenCalled());
    await waitFor(() => expect(useRecuStore.getState().preparation).toBeNull());
    expect(screen.queryByLabelText('Préparation du reçu…')).toBeNull();
  });

  it('détail illisible : reçu généré quand même avec « Détail indisponible », puis message', async () => {
    (chargerDetailRecu as jest.Mock).mockRejectedValue(new Error('Network Error'));
    (useReversementsListe as jest.Mock).mockReturnValue(lecture([reversement]));
    render(<ReversementsHistorique />);
    fireEvent.press(screen.getByLabelText('Partager le reçu'));
    await waitFor(() => expect(partagerRecu).toHaveBeenCalledWith(expect.objectContaining({ detail: { type: 'indisponible' } })));
    await waitFor(() => expect(useDialogStore.getState().open).toBe(true));
    expect(useDialogStore.getState().title).toBe('Détail indisponible');
    expect(useDialogStore.getState().message).toBe(
      'Détail indisponible : le reçu a été généré sans le détail de la période.',
    );
  });

  it('après enregistrement : retour à la liste puis « Partager le reçu » proposé', async () => {
    jest.useFakeTimers();
    const mutate = jest.fn((_req, opts) => opts.onSuccess(reversement));
    (useEnregistrerReversement as jest.Mock).mockReturnValue({ mutate, isPending: false });
    render(<NouveauReversement />);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '300');
    fireEvent.press(screen.getByText(/^Reverser 300 FCFA$/));
    expect(revenirApresEnregistrement).toHaveBeenCalledWith('/(livreur)/cash/reversements', null);
    const d = useDialogStore.getState();
    expect(d.open).toBe(true);
    expect(d.actions?.map((a) => a.label)).toEqual(['Partager le reçu', 'Fermer']);
    d.actions?.[0].onPress?.();
    // Partage différé : après la fermeture complète du dialogue.
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(partagerRecu).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
    jest.useRealTimers();
    await waitFor(() => expect(partagerRecu).toHaveBeenCalledWith(expect.objectContaining({ reference: 'rev-1' })));
    expect(naviguer).not.toHaveBeenCalled();
  });
});
