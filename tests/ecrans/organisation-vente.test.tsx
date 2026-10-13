import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ProduitPicker, type Ligne } from '../../components/livreur/ProduitPicker';
import NouvelleLivraison from '../../app/(livreur)/livraisons/nouvelle';
import RetourClient from '../../app/(livreur)/cash/retour-client';
import { dialog } from '../../lib/dialog';
import { useMesPrixAchat, useResoudrePrix } from '../../features/prix/hooks';
import { indexPrixAchat } from '../../features/prix/plancher';
import LivraisonDetail from '../../app/(livreur)/livraisons/[id]';
import { useFactureDeLivraison } from '../../features/organisation/hooks';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  useLocalSearchParams: () => ({ id: 'l1' }),
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useNavigation: () => ({ getState: () => undefined }),
}));
jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
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
jest.mock('../../features/produits/hooks', () => ({
  useProduits: () => ({ data: [{ id: 'p1', code: 'PROD-1', designation: 'Coca 33cl' }] }),
}));
jest.mock('../../features/stock/hooks', () => ({
  useStockCourant: () => ({ data: [{ produit: { id: 'p1' }, qteVendable: 50 }] }),
}));
jest.mock('../../features/organisation/hooks', () => ({ useFactureDeLivraison: jest.fn() }));
jest.mock('../../features/prix/hooks', () => ({ useResoudrePrix: jest.fn(), useMesPrixAchat: jest.fn() }));
jest.mock('../../features/previsions/hooks', () => ({
  usePrevisionsLivreur: () => ({ data: [] }),
  useLivraisonsDuJour: () => ({ data: [] }),
}));
jest.mock('../../features/clients/hooks', () => ({
  useClientsByLivreur: () => ({ data: [], isLoading: false }),
}));
const mockCreer = { mutate: jest.fn(), isPending: false };
let mockLivraisons: unknown[] = [];
jest.mock('../../features/livraisons/hooks', () => ({
  useCreerLivraison: () => mockCreer,
  useLivraisonsByLivreur: () => ({ data: mockLivraisons, isLoading: false, isFetching: false, refetch: jest.fn() }),
}));
const mockRetour = { mutate: jest.fn(), isPending: false };
jest.mock('../../features/retours/hooks', () => ({ useEnregistrerRetour: () => mockRetour }));
const mockPartage = { enCours: null, facture: jest.fn(), factureDeLivraison: jest.fn(), avoir: jest.fn() };
jest.mock('../../features/organisation/usePartageDocuments', () => ({
  usePartageDocuments: () => mockPartage,
  apresFermetureDialogue: (f: () => void) => f(),
}));
// Client choisi d'un appui ; la ligne vient du vrai ProduitPicker.
jest.mock('../../components/livreur/ClientPicker', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    ClientPicker: ({ onChange }: { onChange: (c: unknown) => void }) => (
      <Text onPress={() => onChange({ id: 'c1', prenom: 'Awa', nom: 'T', avecOuSansRemise: true, remiseUnitaire: 25 })}>
        choisir-client
      </Text>
    ),
  };
});

const resoudre = useResoudrePrix as jest.Mock;
const prixResolu = (prix: number | null) =>
  resoudre.mockReturnValue({
    data: { prix, source: prix === null ? null : 'LIVREUR' },
    isError: false,
    isFetching: false,
    refetch: mockRelire,
  });
const mockRelire = jest.fn();
const lectureEnCours = () => resoudre.mockReturnValue({ data: undefined, isError: false, isFetching: true, refetch: mockRelire });
const lectureEnEchec = () => resoudre.mockReturnValue({ data: undefined, isError: true, isFetching: false, refetch: mockRelire });

const wrap = (ui: React.ReactElement) =>
  render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

const prixAchat = useMesPrixAchat as jest.Mock;
const achatCoca = (prix: number) =>
  prixAchat.mockReturnValue({
    data: indexPrixAchat([
      {
        produitId: 'p1',
        designation: 'Coca 33cl',
        prixAchat: prix,
        fournisseur: { id: 'f1', libelle: 'Brasserie' },
        detail: [{ fournisseurId: 'f1', libelle: 'Brasserie', prixAchat: prix }],
      },
    ]),
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = COMMERCIAL;
  mockLivraisons = [];
  prixResolu(500);
  prixAchat.mockReturnValue({ data: undefined });
});

describe('ProduitPicker : prix imposé (O6)', () => {
  const ligne: Ligne = { produitId: 'p1', designation: 'Coca 33cl', prix: 0, qte: 2 };

  it('prix du responsable affiché, non modifiable, sans « Mémoriser » ni remise', () => {
    const onChange = jest.fn();
    wrap(
      <ProduitPicker lignes={[{ ...ligne, prix: 500 }]} onChange={onChange} clientId="c1" remiseClient={25} prixImpose />,
    );
    expect(screen.getByLabelText('Prix imposé : 500')).toBeTruthy();
    expect(screen.getByText(/Prix fixé par ton responsable/)).toBeTruthy();
    // Seule la quantité se saisit.
    expect(screen.queryByDisplayValue('500')).toBeNull();
    expect(screen.getByDisplayValue('2')).toBeTruthy();
    expect(screen.queryByText(/Mémoriser/)).toBeNull();
    expect(screen.queryByText('Remise du client')).toBeNull();
  });

  it('le prix de la ligne est celui du résolveur', () => {
    const onChange = jest.fn();
    wrap(<ProduitPicker lignes={[ligne]} onChange={onChange} clientId="c1" prixImpose />);
    expect(onChange).toHaveBeenCalledWith([{ ...ligne, prix: 500, prixStatut: 'resolu' }]);
  });

  it('lecture en cours : prix vidé, « Prix en cours de lecture… »', () => {
    lectureEnCours();
    const onChange = jest.fn();
    wrap(<ProduitPicker lignes={[{ ...ligne, prix: 500, prixStatut: 'resolu' }]} onChange={onChange} clientId="c1" prixImpose />);
    expect(onChange).toHaveBeenCalledWith([{ ...ligne, prix: 0, prixStatut: 'en-lecture' }]);
    wrap(<ProduitPicker lignes={[{ ...ligne, prixStatut: 'en-lecture' }]} onChange={jest.fn()} clientId="c1" prixImpose />);
    expect(screen.getByText('Prix en cours de lecture…')).toBeTruthy();
  });

  it('changement de client : l’ancien prix est effacé jusqu’à la lecture du nouveau', () => {
    const onChange = jest.fn();
    const ecran = (clientId: string) => (
      <QueryClientProvider client={new QueryClient()}>
        <ProduitPicker lignes={[{ ...ligne, prix: 500, prixStatut: 'resolu' }]} onChange={onChange} clientId={clientId} prixImpose />
      </QueryClientProvider>
    );
    const { rerender } = render(ecran('c1'));
    onChange.mockClear();
    lectureEnCours();
    rerender(ecran('c2'));
    expect(onChange).toHaveBeenCalledWith([{ ...ligne, prix: 0, prixStatut: 'en-lecture' }]);
  });

  it('lecture en échec : message réseau et « Réessayer », pas « Aucun prix fixé »', () => {
    lectureEnEchec();
    const onChange = jest.fn();
    wrap(<ProduitPicker lignes={[ligne]} onChange={onChange} clientId="c1" prixImpose />);
    expect(onChange).toHaveBeenCalledWith([{ ...ligne, prix: 0, prixStatut: 'erreur' }]);
    wrap(<ProduitPicker lignes={[{ ...ligne, prixStatut: 'erreur' }]} onChange={jest.fn()} clientId="c1" prixImpose />);
    expect(screen.getByText('Prix de Coca 33cl indisponible : vérifie ta connexion puis réessaie.')).toBeTruthy();
    expect(screen.queryByText(/Aucun prix fixé/)).toBeNull();
    fireEvent.press(screen.getByLabelText('Relire le prix de Coca 33cl'));
    expect(mockRelire).toHaveBeenCalled();
  });

  it('aucun prix fixé : message de la spec', () => {
    prixResolu(null);
    wrap(<ProduitPicker lignes={[{ ...ligne, prixStatut: 'resolu' }]} onChange={jest.fn()} clientId="c1" prixImpose />);
    expect(screen.getByText('Aucun prix fixé pour Coca 33cl : contactez votre responsable.')).toBeTruthy();
  });

  it('hors organisation : prix saisissable comme avant', () => {
    wrap(<ProduitPicker lignes={[{ ...ligne, prix: 500 }]} onChange={jest.fn()} clientId="c1" />);
    expect(screen.getByDisplayValue('500')).toBeTruthy();
    expect(screen.queryByLabelText(/Prix imposé/)).toBeNull();
  });
});

describe('Nouvelle livraison du commercial', () => {
  const vendre = () => {
    wrap(<NouvelleLivraison />);
    fireEvent.press(screen.getByText('choisir-client'));
    fireEvent.press(screen.getByText('Coca 33cl'));
    fireEvent.press(screen.getByText('Enregistrer'));
  };

  it('envoie le prix résolu, sans remise ni mémorisation, puis propose « Partager la facture »', () => {
    vendre();
    expect(mockCreer.mutate).toHaveBeenCalledTimes(1);
    const [payload, options] = mockCreer.mutate.mock.calls[0];
    expect(payload).toEqual({
      livreurId: 'k1',
      clientId: 'c1',
      avecRemise: false,
      produitsLivraison: [
        { produitId: 'p1', qteLivree: 1, qteRetournee: 0, qteRetourneeEnStock: 0, prixDeVente: 500, memoriserPrixClient: false },
      ],
    });
    act(() => options.onSuccess({ id: 'l1' }));
    const [titre, , opts] = (dialog.success as jest.Mock).mock.calls[0];
    expect(titre).toBe('Livraison enregistrée');
    const partager = opts.actions.find((a: { label: string }) => a.label === 'Partager la facture');
    partager.onPress();
    expect(mockPartage.factureDeLivraison).toHaveBeenCalledWith('l1');
  });

  it('aucun prix fixé : vente bloquée avec le message de la spec', () => {
    prixResolu(null);
    vendre();
    expect(mockCreer.mutate).not.toHaveBeenCalled();
    expect(dialog.warning).toHaveBeenCalledWith(
      'Ligne invalide',
      'Aucun prix fixé pour Coca 33cl : contactez votre responsable.',
    );
  });

  it('prix en cours de lecture : vente bloquée', () => {
    lectureEnCours();
    vendre();
    expect(mockCreer.mutate).not.toHaveBeenCalled();
    expect(dialog.warning).toHaveBeenCalledWith('Ligne invalide', 'Prix en cours de lecture…');
  });

  it('lecture du prix en échec : vente bloquée avec le message réseau', () => {
    lectureEnEchec();
    vendre();
    expect(mockCreer.mutate).not.toHaveBeenCalled();
    expect(dialog.warning).toHaveBeenCalledWith(
      'Ligne invalide',
      'Prix de Coca 33cl indisponible : vérifie ta connexion puis réessaie.',
    );
  });

  it('commercial : ni prix d’achat lu ni plancher (B2B hors périmètre)', () => {
    achatCoca(1500);
    vendre();
    expect(prixAchat).toHaveBeenCalledWith(false);
    expect(mockCreer.mutate).toHaveBeenCalledTimes(1);
  });

  it('livreur indépendant : prix tapé sous le prix d’achat, vente refusée avec le message du back (P5)', () => {
    mockUser = { id: 'l9', prenom: 'Awa', nom: 'K', parentId: null };
    achatCoca(1500);
    wrap(<NouvelleLivraison />);
    fireEvent.press(screen.getByText('choisir-client'));
    fireEvent.press(screen.getByText('Coca 33cl'));
    fireEvent.changeText(screen.getByDisplayValue('500'), '400');
    fireEvent.press(screen.getByText('Enregistrer'));
    expect(prixAchat).toHaveBeenCalledWith(true);
    expect(mockCreer.mutate).not.toHaveBeenCalled();
    expect(dialog.error).toHaveBeenCalledWith(
      'Prix refusé',
      "Le prix de vente de Coca 33cl (400 F) est inférieur au prix d'achat (1 500 F).",
    );
    // L'alerte est aussi affichée sur la ligne.
    expect(screen.getByText("Le prix de vente de Coca 33cl (400 F) est inférieur au prix d'achat (1 500 F).")).toBeTruthy();
  });

  it('livreur indépendant : prix proposé par le système sous le prix d’achat, jamais bloqué (P5)', () => {
    mockUser = { id: 'l9', prenom: 'Awa', nom: 'K', parentId: null };
    achatCoca(1500);
    vendre();
    expect(prixAchat).toHaveBeenCalledWith(true);
    expect(mockCreer.mutate).toHaveBeenCalledTimes(1);
    expect(dialog.error).not.toHaveBeenCalled();
    expect(screen.queryByText(/est inférieur au prix d'achat/)).toBeNull();
  });

  it('livreur indépendant : prix égal au prix d’achat ou sans prix d’achat connu, vente envoyée', () => {
    mockUser = { id: 'l9', prenom: 'Awa', nom: 'K', parentId: null };
    achatCoca(500);
    vendre();
    expect(mockCreer.mutate).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/est inférieur au prix d'achat/)).toBeNull();
  });

  it('livreur indépendant : pas de facture proposée', () => {
    mockUser = { id: 'l9', prenom: 'Awa', nom: 'K', parentId: null };
    vendre();
    act(() => mockCreer.mutate.mock.calls[0][1].onSuccess({ id: 'l2' }));
    expect(dialog.success).toHaveBeenCalledWith('Livraison enregistrée');
  });
});

describe('Retour produit sur une vente facturée (O14)', () => {
  const livraison = {
    id: 'l1',
    date: new Date().toISOString(),
    client: { id: 'c1', prenom: 'Awa', nom: 'T' },
    montantDu: 1000,
    produitsLivraison: [
      { id: 'pl1', produit: { id: 'p1', designation: 'Coca 33cl' }, qteLivre: 2, qteRetourne: 0, prixDeVente: 500, remiseUnitaire: 0 },
    ],
  };

  const retourner = () => {
    mockLivraisons = [livraison];
    wrap(<RetourClient />);
    fireEvent.press(screen.getByText('Choisir une livraison récente'));
    fireEvent.press(screen.getByText('Awa T'));
    fireEvent.changeText(screen.getByPlaceholderText('0'), '1');
    fireEvent.press(screen.getByText('Perdu'));
    fireEvent.press(screen.getByText('Enregistrer le retour'));
  };

  it('avoir émis : « Partager l’avoir » ouvre son PDF', () => {
    retourner();
    expect(mockRetour.mutate).toHaveBeenCalledTimes(1);
    act(() =>
      mockRetour.mutate.mock.calls[0][1].onSuccess({
      retours: [],
      livraison,
      avoir: { id: 'a1', numero: 'AV-2026-000001', date: '2026-10-13T11:02:00', totalTtc: 500 },
    }),
    );
    const [titre, message, opts] = (dialog.success as jest.Mock).mock.calls[0];
    expect(titre).toBe('Retour produit enregistré');
    expect(message).toContain('AV-2026-000001');
    opts.actions.find((a: { label: string }) => a.label === 'Partager l’avoir').onPress();
    expect(mockPartage.avoir).toHaveBeenCalledWith('a1');
  });

  it('sans avoir (vente non facturée) : message habituel', () => {
    retourner();
    act(() =>
      mockRetour.mutate.mock.calls[0][1].onSuccess({ retours: [], livraison }),
    );
    expect(dialog.success).toHaveBeenCalledWith('Retour produit enregistré', 'Stock et dû du client mis à jour');
  });
});

describe('Fiche livraison : « Partager la facture » (O17)', () => {
  const livraison = {
    id: 'l1',
    date: '2026-10-13T10:00:00',
    client: { id: 'c1', prenom: 'Awa', nom: 'T', contact: '', latitudeLongitude: null, quartier: null },
    produitsLivraison: [],
    montantDu: 1000,
    montantPaye: 0,
    resteDu: 1000,
    remiseNette: 0,
    statutEncaissement: 'NON_ENCAISSEE',
    encaissementReferences: [],
  };

  it('vente facturée : bouton présent, partage de la facture de la vente', () => {
    mockLivraisons = [livraison];
    (useFactureDeLivraison as jest.Mock).mockReturnValue({ data: { id: 'f1', numero: 'FAC-2026-000001' } });
    wrap(<LivraisonDetail />);
    expect(useFactureDeLivraison).toHaveBeenCalledWith('l1');
    fireEvent.press(screen.getByText('Partager la facture'));
    expect(mockPartage.factureDeLivraison).toHaveBeenCalledWith('l1');
  });

  it('vente sans facture (indépendant, vente antérieure) : pas de bouton', () => {
    mockLivraisons = [livraison];
    (useFactureDeLivraison as jest.Mock).mockReturnValue({ data: null });
    wrap(<LivraisonDetail />);
    expect(screen.queryByText('Partager la facture')).toBeNull();
  });
});
