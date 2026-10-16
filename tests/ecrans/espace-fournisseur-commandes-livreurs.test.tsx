import { fireEvent, render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import CommandesFournisseur from '../../app/fournisseur/commandes/index';
import CommandeFournisseur from '../../app/fournisseur/commandes/[id]';
import LivreursFournisseur from '../../app/fournisseur/livreurs/index';
import InvitationsFournisseur from '../../app/fournisseur/livreurs/invitations';
import FicheLivreurPartenaire from '../../app/fournisseur/livreurs/[id]/index';
import CommandesDuLivreur from '../../app/fournisseur/livreurs/[id]/commandes/index';
import CommandeDuLivreur from '../../app/fournisseur/livreurs/[id]/commandes/[commandeId]';
import PrixParticuliersLivreur from '../../app/fournisseur/livreurs/[id]/prix';
import VersementRecu from '../../app/fournisseur/livreurs/[id]/versement';
import * as hooks from '../../features/fournisseur/hooks';
import { naviguer, retourParent } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import type { CommandeResponse, LivreurPartenaireDuResponse } from '../../types/api';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  usePathname: () => '/fournisseur/livreurs/l1/versement',
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
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
let mockEnLigne = true;
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: mockEnLigne }),
}));
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: (sel: (s: unknown) => unknown) => sel({ effective: 'light' }),
}));

jest.mock('../../features/fournisseur/hooks', () => ({
  useCommandesFournisseur: jest.fn(),
  useLivreursPartenaires: jest.fn(),
  useCompteInvitations: jest.fn(),
  useInvitationsFournisseur: jest.fn(),
  useCommandesLivreurFournisseur: jest.fn(),
  usePrixParticuliersLivreur: jest.fn(),
  useSituationVersementFournisseur: jest.fn(),
  useConfirmerCommandeFournisseur: jest.fn(),
  useRefuserCommandeFournisseur: jest.fn(),
  useEnregistrerRemiseLivreur: jest.fn(),
  useSupprimerRemiseLivreur: jest.fn(),
  useEnregistrerPrixParticulier: jest.fn(),
  useSupprimerPrixParticulier: jest.fn(),
  useBloquerLivreur: jest.fn(),
  useDebloquerLivreur: jest.fn(),
  useEnregistrerVersementFournisseur: jest.fn(),
  useAccepterInvitation: jest.fn(),
  useRefuserInvitation: jest.fn(),
}));

const m = <T extends keyof typeof hooks>(nom: T) => hooks[nom] as unknown as jest.Mock;
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});

type Options = { onSuccess?: (r?: unknown) => void; onError?: (e: unknown) => void; onSettled?: () => void };
/** Mutation simulée : réussit (ou échoue avec `erreur`) tout de suite, puis libère le verrou. */
function mutation(erreur?: unknown) {
  const mutate = jest.fn((_vars: unknown, o?: Options) => {
    if (erreur) o?.onError?.(erreur);
    else o?.onSuccess?.();
    o?.onSettled?.();
  });
  return { mutate, isPending: false };
}
const MUTATIONS = [
  'useConfirmerCommandeFournisseur',
  'useRefuserCommandeFournisseur',
  'useEnregistrerRemiseLivreur',
  'useSupprimerRemiseLivreur',
  'useEnregistrerPrixParticulier',
  'useSupprimerPrixParticulier',
  'useBloquerLivreur',
  'useDebloquerLivreur',
  'useEnregistrerVersementFournisseur',
  'useAccepterInvitation',
  'useRefuserInvitation',
] as const;
let muts: Record<(typeof MUTATIONS)[number], ReturnType<typeof mutation>>;

const AWA = { id: 'l1', nom: 'Yao', prenom: 'Awa', contact: '0701020304' };
const commande = (over: Partial<CommandeResponse>): CommandeResponse =>
  ({
    id: 'c1',
    reference: 'CMDE-1',
    statut: 'ENVOYEE',
    date: '2026-10-14T08:00:00',
    dateDecision: null,
    motifRefus: null,
    dateLivraison: null,
    montantLivre: null,
    montantEstime: 12500,
    remiseLivreurLivree: null,
    versementId: null,
    livreur: AWA,
    fournisseur: { id: 'f1', libelle: 'Boulangerie 2000' },
    produitsCommandes: [
      {
        id: 'pc1',
        produit: { id: 'p1', designation: 'Baguette' },
        qteCommandee: 50,
        qteRecue: 0,
        qteRestante: 50,
        montantRecu: 0,
        remiseLivreurRecue: 0,
      },
    ],
    apprentiAffecte: null,
    affectePar: null,
    dateAffectation: null,
    receptions: [],
    livreeManuellement: false,
    livreePar: null,
    dateLivree: null,
    ...over,
  }) as CommandeResponse;

const COMMANDES = [
  commande({}),
  commande({
    id: 'c2',
    reference: 'CMDE-2',
    statut: 'LIVREE',
    date: '2026-10-10T08:00:00',
    dateLivraison: '2026-10-11T08:00:00',
    montantLivre: 30000,
    remiseLivreurLivree: 1500,
    livreur: { ...AWA, id: 'l2', prenom: 'Marc', nom: 'Konan' } as CommandeResponse['livreur'],
  }),
  commande({ id: 'c3', reference: 'CMDE-3', statut: 'CONFIRMEE', date: '2026-09-01T08:00:00' }),
];

const partenaire = (over: Partial<LivreurPartenaireDuResponse> = {}): LivreurPartenaireDuResponse => ({
  livreur: AWA,
  bloque: false,
  remiseUnitaire: 25,
  totalRecu: 100000,
  totalVerse: 93000,
  du: 7000,
  remiseAReverser: 1250,
  dernierVersement: '2026-10-05T10:00:00',
  ...over,
});

function rendu(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockEnLigne = true;
  m('useCommandesFournisseur').mockReturnValue(lecture(COMMANDES));
  m('useLivreursPartenaires').mockReturnValue(
    lecture([partenaire(), partenaire({ livreur: { id: 'l2', nom: 'Konan', prenom: 'Marc', contact: null }, du: -500, bloque: true, remiseUnitaire: 0, remiseAReverser: 0 })]),
  );
  m('useCompteInvitations').mockReturnValue(lecture(2));
  m('useInvitationsFournisseur').mockReturnValue(
    lecture([{ id: 'i1', dateInvitation: '2026-10-15T09:30:00', livreur: { id: 'l9', nom: 'Diallo', prenom: 'Ibrahim', contact: '0505050505' } }]),
  );
  m('useCommandesLivreurFournisseur').mockReturnValue(lecture([COMMANDES[0], commande({ id: 'c4', reference: 'CMDE-4', statut: 'LIVREE', montantLivre: 20000, remiseLivreurLivree: 1000, dateLivraison: '2026-10-12T08:00:00' })]));
  m('usePrixParticuliersLivreur').mockReturnValue(
    lecture([
      { produitFournisseurId: 'pf1', produit: { id: 'p1', code: 'BAG', designation: 'Baguette' }, prixDeBase: 150, prixParticulier: 140 },
      { produitFournisseurId: 'pf2', produit: { id: 'p2', code: 'PDM', designation: 'Pain de mie' }, prixDeBase: 900, prixParticulier: null },
    ]),
  );
  m('useSituationVersementFournisseur').mockReturnValue(
    lecture({ valeurAchat: 21000, remiseLivreurCumulee: 1000, detteAvant: 500, totalDu: 21500, dateDebut: null, dateFin: null, nbCommandes: 1 }),
  );
  muts = {} as typeof muts;
  for (const nom of MUTATIONS) {
    muts[nom] = mutation();
    m(nom).mockImplementation(() => muts[nom]);
  }
});

describe('FM2 : onglet Commandes du fournisseur', () => {
  it('liste : plus récentes d’abord, livreur, montant estimé puis livré ; filtre « À traiter » ; détail', () => {
    rendu(<CommandesFournisseur />);
    expect(screen.getByText('Commandes reçues')).toBeTruthy();
    const refs = screen.getAllByText(/^CMDE-\d$/).map((n) => n.props.children);
    expect(refs).toEqual(['CMDE-1', 'CMDE-2', 'CMDE-3']);
    expect(screen.getByText('Montant livré : 30 000 F')).toBeTruthy();
    expect(screen.getAllByText('Montant estimé : 12 500 F')).toHaveLength(2);
    expect(screen.getByText('Marc Konan')).toBeTruthy();

    fireEvent.press(screen.getByText('À traiter'));
    expect(screen.queryByText('CMDE-2')).toBeNull();
    expect(screen.queryByText('CMDE-3')).toBeNull();
    fireEvent.press(screen.getByLabelText('Commande CMDE-1'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/commandes/c1');
  });

  it('recherche par livreur ou référence', () => {
    rendu(<CommandesFournisseur />);
    fireEvent.changeText(screen.getByPlaceholderText('Référence ou livreur…'), 'konan');
    expect(screen.getByText('CMDE-2')).toBeTruthy();
    expect(screen.queryByText('CMDE-1')).toBeNull();
    fireEvent.changeText(screen.getByPlaceholderText('Référence ou livreur…'), 'zzz');
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('vide, chargement, erreur (message du back tel quel)', () => {
    m('useCommandesFournisseur').mockReturnValue(lecture([]));
    const { unmount } = rendu(<CommandesFournisseur />);
    expect(screen.getByText('Aucune commande')).toBeTruthy();
    unmount();
    m('useCommandesFournisseur').mockReturnValue(lecture(undefined, { isLoading: true }));
    const r2 = rendu(<CommandesFournisseur />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
    r2.unmount();
    const refetch = jest.fn();
    m('useCommandesFournisseur').mockReturnValue(
      lecture(undefined, { isError: true, error: { response: { data: { message: 'Service indisponible' } } }, refetch }),
    );
    rendu(<CommandesFournisseur />);
    expect(screen.getByText('Service indisponible')).toBeTruthy();
    fireEvent.press(screen.getByText('Réessayer'));
    expect(refetch).toHaveBeenCalled();
  });

  it('détail d’une envoyée : Confirmer (un seul envoi)', () => {
    mockParams = { id: 'c1' };
    rendu(<CommandeFournisseur />);
    expect(screen.getByText('CMDE-1')).toBeTruthy();
    expect(screen.getByText('Baguette')).toBeTruthy();
    expect(screen.getByText('Montant estimé')).toBeTruthy();
    expect(screen.getByText('12 500 FCFA')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Confirmer'));
    expect(muts.useConfirmerCommandeFournisseur.mutate).toHaveBeenCalledWith('c1', expect.anything());
    expect(dialog.success).toHaveBeenCalledWith('Commande confirmée');
  });

  it('double appui sur Confirmer pendant l’envoi : une seule requête', () => {
    mockParams = { id: 'c1' };
    const mutate = jest.fn();
    muts.useConfirmerCommandeFournisseur = { mutate, isPending: false };
    rendu(<CommandeFournisseur />);
    fireEvent.press(screen.getByLabelText('Confirmer'));
    fireEvent.press(screen.getByLabelText('Confirmer'));
    expect(mutate).toHaveBeenCalledTimes(1);
  });

  it('Refuser : motif obligatoire, puis envoyé ; message du back affiché tel quel', () => {
    mockParams = { id: 'c3' };
    rendu(<CommandeFournisseur />);
    expect(screen.queryByLabelText('Confirmer')).toBeNull();
    fireEvent.press(screen.getByLabelText('Refuser'));
    expect(screen.getByText('Awa Yao sera informé du refus. Cette action est définitive.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Refuser la commande'));
    expect(screen.getByText('Indique le motif du refus.')).toBeTruthy();
    expect(muts.useRefuserCommandeFournisseur.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Motif du refus'), '  rupture de stock ');
    fireEvent.press(screen.getByLabelText('Refuser la commande'));
    expect(muts.useRefuserCommandeFournisseur.mutate).toHaveBeenCalledWith(
      { id: 'c3', motif: 'rupture de stock' },
      expect.anything(),
    );
    expect(dialog.success).toHaveBeenCalledWith('Commande refusée');

    muts.useRefuserCommandeFournisseur = mutation({ response: { data: { message: 'Commande déjà en réception.' } } });
    fireEvent.press(screen.getByLabelText('Refuser'));
    fireEvent.changeText(screen.getByLabelText('Motif du refus'), 'trop tard');
    fireEvent.press(screen.getByLabelText('Refuser la commande'));
    expect(dialog.error).toHaveBeenCalledWith('Erreur', 'Commande déjà en réception.');
  });

  it('livrée : lecture seule (pas de Confirmer ni Refuser) ; montant livré et remise', () => {
    mockParams = { id: 'c2' };
    rendu(<CommandeFournisseur />);
    expect(screen.getByText('Montant livré')).toBeTruthy();
    expect(screen.getByText('30 000 FCFA')).toBeTruthy();
    expect(screen.getByText('1 500 F')).toBeTruthy();
    expect(screen.queryByLabelText('Confirmer')).toBeNull();
    expect(screen.queryByLabelText('Refuser')).toBeNull();
  });

  it('hors ligne : actions désactivées', () => {
    mockEnLigne = false;
    mockParams = { id: 'c1' };
    rendu(<CommandeFournisseur />);
    expect(screen.getAllByText('Hors ligne — réessaye en ligne')).toHaveLength(2);
    fireEvent.press(screen.getAllByText('Hors ligne — réessaye en ligne')[0]);
    expect(muts.useConfirmerCommandeFournisseur.mutate).not.toHaveBeenCalled();
  });

  it('commande introuvable : la liste est relue une fois avant de le dire', () => {
    mockParams = { id: 'zz' };
    const q = lecture(COMMANDES);
    m('useCommandesFournisseur').mockReturnValue(q);
    rendu(<CommandeFournisseur />);
    expect(q.refetch).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Commande introuvable')).toBeTruthy();
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });

  it('pendant la relecture : Chargement, pas « introuvable »', () => {
    mockParams = { id: 'zz' };
    m('useCommandesFournisseur').mockReturnValue(lecture(COMMANDES, { isFetching: true }));
    rendu(<CommandeFournisseur />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
  });

  it('panneau Refuser fermé quand la commande, relue, n’est plus refusable', () => {
    mockParams = { id: 'c1' };
    const vue = rendu(<CommandeFournisseur />);
    fireEvent.press(screen.getByLabelText('Refuser'));
    expect(screen.getByText(/sera informé du refus/)).toBeTruthy();
    m('useCommandesFournisseur').mockReturnValue(lecture([commande({ statut: 'EN_RECEPTION' })]));
    vue.rerender(<QueryClientProvider client={new QueryClient()}><CommandeFournisseur /></QueryClientProvider>);
    expect(screen.queryByText(/sera informé du refus/)).toBeNull();
  });
});

describe('FM2 : onglet Livreurs du fournisseur', () => {
  it('liste : dû ou avance, bloqué, remise, à reverser ; Invitations avec badge ; fiche', () => {
    rendu(<LivreursFournisseur />);
    expect(screen.getByText('Livreurs partenaires')).toBeTruthy();
    expect(screen.getByText('Dû 7 000 F')).toBeTruthy();
    expect(screen.getByText('Avance 500 F')).toBeTruthy();
    expect(screen.getByText('Bloqué')).toBeTruthy();
    expect(screen.getByText('Remise / unité : 25 F')).toBeTruthy();
    expect(screen.getByText('À reverser : 1 250 F')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Invitations : 2 en attente'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/livreurs/invitations');
    fireEvent.press(screen.getByLabelText('Fiche de Awa Yao'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/livreurs/l1');
  });

  it('vide et erreur', () => {
    m('useLivreursPartenaires').mockReturnValue(lecture([]));
    const { unmount } = rendu(<LivreursFournisseur />);
    expect(screen.getByText('Aucun livreur partenaire.')).toBeTruthy();
    unmount();
    m('useLivreursPartenaires').mockReturnValue(lecture(undefined, { isError: true, error: {} }));
    rendu(<LivreursFournisseur />);
    expect(screen.getByText('Livreurs partenaires indisponibles')).toBeTruthy();
  });

  it('invitations : accepter direct ; refuser après confirmation', () => {
    rendu(<InvitationsFournisseur />);
    expect(screen.getByText('Ibrahim Diallo')).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Accepter l'invitation de Ibrahim Diallo"));
    expect(muts.useAccepterInvitation.mutate).toHaveBeenCalledWith('i1', expect.anything());
    expect(dialog.success).toHaveBeenCalledWith('Invitation acceptée');

    fireEvent.press(screen.getByLabelText("Refuser l'invitation de Ibrahim Diallo"));
    expect(muts.useRefuserInvitation.mutate).not.toHaveBeenCalled();
    const confirmation = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(confirmation.title).toBe("Refuser l'invitation de Ibrahim Diallo ?");
    confirmation.onConfirm();
    expect(muts.useRefuserInvitation.mutate).toHaveBeenCalledWith('i1', expect.anything());
    expect(dialog.success).toHaveBeenCalledWith('Invitation refusée');
  });

  it('invitations : vide', () => {
    m('useInvitationsFournisseur').mockReturnValue(lecture([]));
    rendu(<InvitationsFournisseur />);
    expect(screen.getByText('Aucune invitation en attente.')).toBeTruthy();
  });

  it('fiche : chiffres et liens (commandes, prix particuliers, versement)', () => {
    mockParams = { id: 'l1' };
    rendu(<FicheLivreurPartenaire />);
    expect(screen.getByText('Awa Yao')).toBeTruthy();
    expect(screen.getByText('7 000 F')).toBeTruthy();
    expect(screen.getByLabelText('Total versé : 93 000 F')).toBeTruthy();
    expect(screen.getByLabelText('Remise à reverser : 1 250 F')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Commandes'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/livreurs/l1/commandes');
    fireEvent.press(screen.getByLabelText('Prix particuliers'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/livreurs/l1/prix');
    fireEvent.press(screen.getByLabelText('Enregistrer un versement'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/livreurs/l1/versement');
  });

  it('fiche : remise contrôlée puis enregistrée ; suppression', () => {
    mockParams = { id: 'l1' };
    rendu(<FicheLivreurPartenaire />);
    fireEvent.press(screen.getByLabelText('Remise'));
    fireEvent.changeText(screen.getByLabelText('Remise livreur'), '-3');
    fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(screen.getByText('La remise livreur ne peut pas être négative.')).toBeTruthy();
    expect(muts.useEnregistrerRemiseLivreur.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Remise livreur'), '30,5');
    fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(muts.useEnregistrerRemiseLivreur.mutate).toHaveBeenCalledWith(
      { livreurId: 'l1', remiseLivreur: 30.5 },
      expect.anything(),
    );
    expect(dialog.success).toHaveBeenCalledWith('Remise livreur enregistrée');
    fireEvent.press(screen.getByLabelText('Remise'));
    fireEvent.press(screen.getByText('Supprimer la remise'));
    expect(muts.useSupprimerRemiseLivreur.mutate).toHaveBeenCalledWith('l1', expect.anything());
  });

  it('fiche : bloquer (motif facultatif) ; un bloqué : débloquer après confirmation, remise et prix fermés', () => {
    mockParams = { id: 'l1' };
    const { unmount } = rendu(<FicheLivreurPartenaire />);
    fireEvent.press(screen.getByLabelText('Bloquer'));
    expect(screen.getByText('Bloquer Awa Yao ?')).toBeTruthy();
    // Le panneau s'ouvre au-dessus des actions : son bouton vient en premier.
    fireEvent.press(screen.getAllByLabelText('Bloquer')[0]);
    expect(muts.useBloquerLivreur.mutate).toHaveBeenCalledWith({ livreurId: 'l1', motif: undefined }, expect.anything());
    expect(dialog.success).toHaveBeenCalledWith('Livreur bloqué');
    unmount();

    mockParams = { id: 'l2' };
    rendu(<FicheLivreurPartenaire />);
    expect(screen.getByText('Bloqué : il ne peut plus te passer commande.')).toBeTruthy();
    expect(screen.getAllByText('Indisponible pour un livreur bloqué')).toHaveLength(2);
    fireEvent.press(screen.getByLabelText('Prix particuliers'));
    expect(naviguer).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Débloquer'));
    const confirmation = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(confirmation.title).toBe('Débloquer Marc Konan ?');
    confirmation.onConfirm();
    expect(muts.useDebloquerLivreur.mutate).toHaveBeenCalledWith('l2', expect.anything());
  });

  it('fiche : le panneau Remise se ferme quand le livreur, relu, est bloqué', () => {
    mockParams = { id: 'l1' };
    const vue = rendu(<FicheLivreurPartenaire />);
    fireEvent.press(screen.getByLabelText('Remise'));
    expect(screen.getByLabelText('Remise livreur')).toBeTruthy();
    const partenaires = (m('useLivreursPartenaires').mock.results.at(-1)?.value as { data: LivreurPartenaireDuResponse[] }).data;
    m('useLivreursPartenaires').mockReturnValue(
      lecture(partenaires.map((p) => (p.livreur.id === 'l1' ? { ...p, bloque: true } : p))),
    );
    vue.rerender(<QueryClientProvider client={new QueryClient()}><FicheLivreurPartenaire /></QueryClientProvider>);
    expect(screen.queryByLabelText('Remise livreur')).toBeNull();
  });

  it('fiche introuvable', () => {
    mockParams = { id: 'zz' };
    rendu(<FicheLivreurPartenaire />);
    expect(screen.getByText('Livreur introuvable')).toBeTruthy();
  });

  it('commandes du livreur : liste et détail dans la fiche', () => {
    mockParams = { id: 'l1' };
    rendu(<CommandesDuLivreur />);
    expect(screen.getByText('Commandes de Awa Yao')).toBeTruthy();
    expect(m('useCommandesLivreurFournisseur')).toHaveBeenCalledWith('l1');
    fireEvent.press(screen.getByLabelText('Commande CMDE-1'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/livreurs/l1/commandes/c1');
  });

  it('détail ouvert depuis la fiche : mêmes actions', () => {
    mockParams = { id: 'l1', commandeId: 'c1' };
    rendu(<CommandeDuLivreur />);
    fireEvent.press(screen.getByLabelText('Confirmer'));
    expect(muts.useConfirmerCommandeFournisseur.mutate).toHaveBeenCalledWith('c1', expect.anything());
  });

  it('prix particuliers : contrôle, enregistrement, retrait', () => {
    mockParams = { id: 'l1' };
    rendu(<PrixParticuliersLivreur />);
    expect(screen.getByText('Prix particuliers de Awa Yao')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Prix particulier de Pain de mie'), '0');
    fireEvent.press(screen.getByLabelText('Enregistrer le prix de Pain de mie'));
    expect(screen.getByText('Le prix particulier doit être supérieur à 0.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Prix particulier de Pain de mie'), '850');
    fireEvent.press(screen.getByLabelText('Enregistrer le prix de Pain de mie'));
    expect(muts.useEnregistrerPrixParticulier.mutate).toHaveBeenCalledWith(
      { pfId: 'pf2', livreurId: 'l1', prix: 850 },
      expect.anything(),
    );
    fireEvent.press(screen.getByLabelText('Retirer le prix de Baguette'));
    expect(muts.useSupprimerPrixParticulier.mutate).toHaveBeenCalledWith({ pfId: 'pf1', livreurId: 'l1' }, expect.anything());
    // Messages donnés au hook (niveau mutation, robustes au remontage de la ligne).
    m('useSupprimerPrixParticulier').mock.calls.at(-1)[0]();
    expect(dialog.success).toHaveBeenCalledWith('Prix particulier supprimé');
    m('useEnregistrerPrixParticulier').mock.calls.at(-1)[0]();
    expect(dialog.success).toHaveBeenCalledWith('Prix particulier enregistré');
  });

  it('versement reçu : commandes à régler, situation, montant obligatoire, envoi puis retour', () => {
    mockParams = { id: 'l1' };
    rendu(<VersementRecu />);
    // Seule la commande livrée non réglée est proposée.
    expect(screen.getByText('CMDE-4')).toBeTruthy();
    expect(screen.queryByText('CMDE-1')).toBeNull();
    expect(screen.getByText('21 500 FCFA')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(dialog.warning).toHaveBeenCalledWith('Versement incomplet', 'Saisis un montant.');
    fireEvent.press(screen.getByLabelText('Sélectionner CMDE-4'));
    expect(m('useSituationVersementFournisseur')).toHaveBeenLastCalledWith('l1', ['c4']);
    fireEvent.press(screen.getByText('Tout le dû (21 500)'));
    fireEvent.changeText(screen.getByLabelText('Commentaire'), ' solde ');
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(muts.useEnregistrerVersementFournisseur.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ livreurId: 'l1', commandeIds: ['c4'], montantVerse: 21500, commentaire: 'solde' }),
      expect.anything(),
    );
    expect(dialog.success).toHaveBeenCalledWith('Versement enregistré');
    expect(retourParent).toHaveBeenCalledWith('/fournisseur/livreurs/l1/versement');
  });
});
