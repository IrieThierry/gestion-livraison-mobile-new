import { fireEvent, render, screen } from '@testing-library/react-native';
import ArgentFournisseur from '../../app/fournisseur/argent/index';
import VersementsRecus from '../../app/fournisseur/argent/versements/index';
import NouveauVersementRecu from '../../app/fournisseur/argent/versements/nouveau';
import DemandesModifFournisseur from '../../app/fournisseur/argent/versements/demandes';
import DemanderModifFournisseur from '../../app/fournisseur/argent/versements/modifier';
import ReversementsFournisseur from '../../app/fournisseur/argent/reversements';
import DepensesFournisseur from '../../app/fournisseur/argent/depenses/index';
import NouvelleDepenseFournisseur from '../../app/fournisseur/argent/depenses/nouvelle';
import CatalogueFournisseur from '../../app/fournisseur/moi/catalogue/index';
import AjouterProduitCatalogue from '../../app/fournisseur/moi/catalogue/ajouter';
import ModifierProduitCatalogue from '../../app/fournisseur/moi/catalogue/[id]';
import * as hooks from '../../features/fournisseur/hooks';
import * as demandesHooks from '../../features/demandes-modif/hooks';
import * as depensesHooks from '../../features/depenses/hooks';
import { useProduits } from '../../features/produits/hooks';
import { naviguer, retourParent } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { moisDe } from '../../features/fournisseur/regles';
import type {
  DemandeModificationVersementResponse,
  LigneCatalogueFournisseurResponse,
  ReversementRecord,
  VersementResponse,
} from '../../types/api';

let mockParams: Record<string, string> = {};
jest.mock('expo-router', () => ({
  usePathname: () => '/fournisseur/argent',
  useLocalSearchParams: () => mockParams,
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
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
let mockEnLigne = true;
jest.mock('../../stores/networkStore', () => ({
  useNetworkStore: (sel: (s: unknown) => unknown) => sel({ isOnline: mockEnLigne }),
}));
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) =>
    sel({ user: { id: 'f-u1', prenom: 'Ali', nom: 'Kone', parentId: null, profile: 'FOURNISSEUR' } }),
}));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: () => null }));

jest.mock('../../features/fournisseur/hooks', () => ({
  useLivreursPartenaires: jest.fn(),
  useCommandesLivreurFournisseur: jest.fn(),
  useSituationVersementFournisseur: jest.fn(),
  useEnregistrerVersementFournisseur: jest.fn(),
  useDemandesModifFournisseurEnAttente: jest.fn(),
  useReversementsSyntheseFournisseur: jest.fn(),
  useVersementsFournisseur: jest.fn(),
  useReversementsFournisseur: jest.fn(),
  useEnregistrerReversementFournisseur: jest.fn(),
  useCatalogueFournisseur: jest.fn(),
  useActiverProduitCatalogue: jest.fn(),
  useCreerEtActiverProduit: jest.fn(),
  useModifierLigneCatalogue: jest.fn(),
  useDesactiverLigneCatalogue: jest.fn(),
  useReactiverLigneCatalogue: jest.fn(),
  useRenommerProduit: jest.fn(),
}));
jest.mock('../../features/demandes-modif/hooks', () => ({
  useDemandesModif: jest.fn(),
  useApprouverDemandeModif: jest.fn(),
  useRejeterDemandeModif: jest.fn(),
  useCreerDemandeModif: jest.fn(),
}));
jest.mock('../../features/depenses/hooks', () => ({
  useDepenses: jest.fn(),
  useDeleteDepense: jest.fn(),
  useCreateDepense: jest.fn(),
}));
jest.mock('../../features/apprentis/hooks', () => ({ useApprentis: jest.fn() }));
jest.mock('../../features/produits/hooks', () => ({ useProduits: jest.fn() }));

const m = <T extends keyof typeof hooks>(nom: T) => hooks[nom] as unknown as jest.Mock;
const md = <T extends keyof typeof demandesHooks>(nom: T) => demandesHooks[nom] as unknown as jest.Mock;
const mdep = <T extends keyof typeof depensesHooks>(nom: T) => depensesHooks[nom] as unknown as jest.Mock;
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
  const mutateAsync = jest.fn(async () => {
    if (erreur) throw erreur;
    return {};
  });
  return { mutate, mutateAsync, isPending: false };
}
const erreurBack = (message: string) => ({ isAxiosError: true, response: { status: 400, data: { message } } });

const AWA = { id: 'l1', nom: 'Yao', prenom: 'Awa', contact: '0701020304' };
const MARC = { id: 'l2', nom: 'Konan', prenom: 'Marc', contact: '0501020304' };
const partenaire = (livreur: typeof AWA) => ({
  livreur,
  du: 0,
  remiseLivreur: 0,
  remiseAReverser: 0,
  bloque: false,
  dernierVersement: null,
});

const versement = (over: Partial<VersementResponse>): VersementResponse =>
  ({
    id: 'v1',
    livreur: AWA,
    fournisseur: { id: 'f1', libelle: 'Boulangerie 2000' },
    dateDebut: '2026-10-01T00:00:00',
    dateFin: '2026-10-05T00:00:00',
    dateVersement: '2026-10-06T00:00:00',
    valeurAchat: 52000,
    remiseLivreurCumulee: 2000,
    montantVerse: 50000,
    detteAvant: 0,
    detteApres: 0,
    commentaire: null,
    ...over,
  }) as VersementResponse;

const demande = (over: Partial<DemandeModificationVersementResponse>): DemandeModificationVersementResponse => ({
  id: 'd1',
  versementId: 'v1',
  demandeurType: 'LIVREUR',
  demandeurLibelle: 'Awa Yao',
  payloadModif: { montantVerse: 45000 },
  motifDemande: 'Erreur de saisie',
  statut: 'PENDING',
  decideLe: null,
  motifDecision: null,
  createdAt: '2026-10-10T09:00:00',
  ...over,
});

const reversement = (over: Partial<ReversementRecord>): ReversementRecord => ({
  id: 'r1',
  type: 'FOURNISSEUR',
  beneficiaireId: 'l1',
  livreurId: 'l1',
  montant: 3000,
  periodeMois: 9,
  periodeAnnee: 2026,
  dateReversement: '2026-10-02T00:00:00',
  commentaire: null,
  ...over,
});

const ligne = (over: Partial<LigneCatalogueFournisseurResponse>): LigneCatalogueFournisseurResponse => ({
  id: 'pf1',
  produit: { id: 'p1', code: 'PAIN', designation: 'Pain' },
  prixDeVente: 250,
  actif: true,
  dateDesactivation: null,
  nbPrixParticuliers: 2,
  renommable: true,
  ...over,
});

let muts: Record<string, ReturnType<typeof mutation>>;
const MUTATIONS_FRN = [
  'useEnregistrerVersementFournisseur',
  'useEnregistrerReversementFournisseur',
  'useActiverProduitCatalogue',
  'useCreerEtActiverProduit',
  'useModifierLigneCatalogue',
  'useDesactiverLigneCatalogue',
  'useReactiverLigneCatalogue',
  'useRenommerProduit',
] as const;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockEnLigne = true;
  muts = {};
  for (const nom of MUTATIONS_FRN) {
    muts[nom] = mutation();
    m(nom).mockImplementation(() => muts[nom]);
  }
  for (const nom of ['useApprouverDemandeModif', 'useRejeterDemandeModif', 'useCreerDemandeModif'] as const) {
    muts[nom] = mutation();
    md(nom).mockImplementation(() => muts[nom]);
  }
  for (const nom of ['useDeleteDepense', 'useCreateDepense'] as const) {
    muts[nom] = mutation();
    mdep(nom).mockImplementation(() => muts[nom]);
  }
  m('useLivreursPartenaires').mockReturnValue(lecture([partenaire(AWA), partenaire(MARC)]));
  m('useCommandesLivreurFournisseur').mockReturnValue(lecture([]));
  m('useSituationVersementFournisseur').mockReturnValue(
    lecture({ nbCommandes: 0, valeurAchat: 0, remiseLivreurCumulee: 0, detteAvant: 8000, totalDu: 8000 }),
  );
  m('useDemandesModifFournisseurEnAttente').mockReturnValue(lecture([demande({})]));
  m('useVersementsFournisseur').mockReturnValue(
    lecture([
      versement({}),
      versement({
        id: 'v2',
        livreur: MARC as VersementResponse['livreur'],
        montantVerse: 25000,
        remiseLivreurCumulee: 500,
        dateVersement: '2026-10-09T00:00:00',
      }),
    ]),
  );
  m('useReversementsSyntheseFournisseur').mockReturnValue(
    lecture({
      annee: 2026,
      mois: 10,
      aReverserAuxLivreurs: [
        { livreurId: 'l1', prenom: 'Awa', nom: 'Yao', remiseLivreurCumuleeMois: 8000, detteCourante: 2000, montantNetAReverser: 6000 },
        { livreurId: 'l2', prenom: 'Marc', nom: 'Konan', remiseLivreurCumuleeMois: 0, detteCourante: 0, montantNetAReverser: 0 },
      ],
    }),
  );
  m('useReversementsFournisseur').mockReturnValue(
    lecture([reversement({}), reversement({ id: 'r2', montant: 1000, informatif: true, dateReversement: '2026-10-03T00:00:00' })]),
  );
  m('useCatalogueFournisseur').mockReturnValue(
    lecture([
      ligne({}),
      ligne({
        id: 'pf2',
        produit: { id: 'p2', code: 'BAG', designation: 'Baguette' },
        actif: false,
        dateDesactivation: '2026-10-01T00:00:00',
        nbPrixParticuliers: 0,
        renommable: false,
        prixDeVente: 150,
      }),
    ]),
  );
  md('useDemandesModif').mockReturnValue(
    lecture([
      demande({}),
      demande({ id: 'd2', demandeurType: 'FOURNISSEUR', demandeurLibelle: 'Boulangerie 2000', createdAt: '2026-10-11T09:00:00' }),
      demande({ id: 'd3', statut: 'REJECTED', motifDecision: 'Montant juste', createdAt: '2026-10-01T09:00:00' }),
    ]),
  );
  mdep('useDepenses').mockReturnValue(
    lecture([
      {
        id: 'dep1',
        libelle: 'Plein gasoil',
        categorie: 'CARBURANT',
        montant: 15000,
        dateDepense: '2026-10-05',
        commentaire: null,
        proprietaire: { id: 'f-u1', nom: 'Ali Kone' },
      },
    ]),
  );
  (useProduits as jest.Mock).mockReturnValue(
    lecture([
      { id: 'p1', code: 'PAIN', designation: 'Pain' },
      { id: 'p2', code: 'BAG', designation: 'Baguette' },
      { id: 'p3', code: 'CRO', designation: 'Croissant' },
    ]),
  );
});

const confirmer = async () => {
  const options = (dialog.confirm as jest.Mock).mock.calls.at(-1)[0];
  await options.onConfirm();
  return options;
};

describe('FM3 : onglet Argent du fournisseur', () => {
  it('rubriques : versements (total du mois), enregistrer, demandes (badge), reversements, dépenses', () => {
    render(<ArgentFournisseur />);
    expect(m('useVersementsFournisseur')).toHaveBeenCalledWith(moisDe());
    expect(screen.getByText('75 000 F reçus ce mois')).toBeTruthy();
    expect(screen.getByText('6 000 F à reverser ce mois')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Versements reçus'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/versements');
    fireEvent.press(screen.getByLabelText('Enregistrer un versement'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/versements/nouveau');
    fireEvent.press(screen.getByLabelText('Demandes de modification : 1 à traiter'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/versements/demandes');
    fireEvent.press(screen.getByLabelText('Reversements'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/reversements');
    fireEvent.press(screen.getByLabelText('Dépenses'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/depenses');
  });

  it('versements reçus : plus récents d’abord, totaux, toutes périodes, demander une modification', () => {
    render(<VersementsRecus />);
    expect(screen.getByText('75 000 F')).toBeTruthy();
    expect(screen.getByText('dont remise livreur : 2 500 F')).toBeTruthy();
    const noms = screen.getAllByText(/^(Awa Yao|Marc Konan)$/).map((n) => n.props.children);
    expect(noms).toEqual(['Marc Konan', 'Awa Yao']);
    expect(screen.getByText('Valeur achat 52 000 F · remise livreur 2 000 F')).toBeTruthy();
    fireEvent.press(screen.getByText('Toutes périodes'));
    expect(m('useVersementsFournisseur')).toHaveBeenLastCalledWith(undefined);
    expect(screen.getByText('Total cumulé')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Demander une modification du versement de Awa Yao'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/versements/modifier', { versementId: 'v1' });
    fireEvent.press(screen.getByLabelText('Demandes de modification : 1 à décider'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/versements/demandes');
  });

  it('versements reçus : vide, chargement, erreur (message du back)', () => {
    m('useVersementsFournisseur').mockReturnValue(lecture([]));
    const { unmount } = render(<VersementsRecus />);
    expect(screen.getByText('Pas de versement sur ce mois.')).toBeTruthy();
    unmount();
    m('useVersementsFournisseur').mockReturnValue(lecture(undefined, { isLoading: true }));
    const r2 = render(<VersementsRecus />);
    expect(screen.getByText('Chargement…')).toBeTruthy();
    r2.unmount();
    m('useVersementsFournisseur').mockReturnValue(lecture(undefined, { isError: true, error: erreurBack('Accès refusé') }));
    render(<VersementsRecus />);
    expect(screen.getByText('Accès refusé')).toBeTruthy();
  });

  it('enregistrer un versement : livreur à choisir d’abord, puis versement libre envoyé une fois', () => {
    render(<NouveauVersementRecu />);
    expect(screen.getByText('Choisis d’abord le livreur.')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Montant versé'), '5000');
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(dialog.warning).toHaveBeenLastCalledWith('Versement incomplet', 'Choisis le livreur qui a versé.');
    expect(muts.useEnregistrerVersementFournisseur.mutate).not.toHaveBeenCalled();

    fireEvent.press(screen.getByText('Choisir un livreur partenaire'));
    fireEvent.press(screen.getByText('Marc Konan'));
    expect(m('useCommandesLivreurFournisseur')).toHaveBeenLastCalledWith('l2');
    expect(screen.getByText('Tout le dû (8 000)')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(muts.useEnregistrerVersementFournisseur.mutate).toHaveBeenCalledTimes(1);
    expect(muts.useEnregistrerVersementFournisseur.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ livreurId: 'l2', montantVerse: 5000, commandeIds: undefined }),
    );
    expect(retourParent).toHaveBeenCalled();
  });

  it('demandes : celle du livreur s’approuve après confirmation ; la mienne attend le livreur ; historique', async () => {
    render(<DemandesModifFournisseur />);
    expect(md('useDemandesModif')).toHaveBeenCalledWith(true, 'fournisseur');
    expect(md('useApprouverDemandeModif')).toHaveBeenCalledWith('fournisseur');
    expect(m('useVersementsFournisseur')).toHaveBeenCalledWith();
    expect(screen.getByText('2 en attente')).toBeTruthy();
    expect(screen.getAllByText(/^Initiée par Awa Yao/)).toHaveLength(2);
    expect(screen.getByText(/^Initiée par moi/)).toBeTruthy();
    expect(screen.getByText('En attente de la décision du livreur')).toBeTruthy();
    expect(screen.getByText('Motif de la décision : Montant juste')).toBeTruthy();
    // Titre : le livreur du versement.
    expect(screen.getAllByText(/^Awa Yao · /).length).toBeGreaterThan(0);
    fireEvent.press(screen.getByText('Approuver'));
    await confirmer();
    expect(muts.useApprouverDemandeModif.mutate.mock.calls[0][0]).toBe('d1');
    expect(dialog.success).toHaveBeenCalledWith('Demande approuvée', 'Versement modifié et dette recalculée.');
  });

  it('demandes : rejet avec motif obligatoire ; message du back tel quel', () => {
    muts.useRejeterDemandeModif = mutation(erreurBack('Demande déjà décidée'));
    render(<DemandesModifFournisseur />);
    fireEvent.press(screen.getByText('Rejeter'));
    fireEvent.press(screen.getByText('Confirmer le rejet'));
    expect(dialog.warning).toHaveBeenCalledWith('Motif manquant', 'Le motif du rejet est obligatoire.');
    fireEvent.changeText(screen.getByLabelText('Motif du rejet'), 'Montant juste');
    fireEvent.press(screen.getByText('Confirmer le rejet'));
    expect(muts.useRejeterDemandeModif.mutate.mock.calls[0][0]).toEqual({ id: 'd1', motif: 'Montant juste' });
    expect(dialog.error).toHaveBeenCalledWith('Erreur', 'Demande déjà décidée');
  });

  it('demandes : vide et erreur', () => {
    md('useDemandesModif').mockReturnValue(lecture([]));
    const { unmount } = render(<DemandesModifFournisseur />);
    expect(screen.getByText('Aucune demande')).toBeTruthy();
    unmount();
    md('useDemandesModif').mockReturnValue(lecture(undefined, { isError: true, error: erreurBack('Indisponible') }));
    render(<DemandesModifFournisseur />);
    expect(screen.getByText('Indisponible')).toBeTruthy();
  });

  it('demander une modification : motif obligatoire, envoi au rôle fournisseur, retour', () => {
    mockParams = { versementId: 'v1' };
    render(<DemanderModifFournisseur />);
    expect(md('useCreerDemandeModif')).toHaveBeenCalledWith('fournisseur');
    expect(screen.getByText(/reçu de Awa Yao\./)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Nouveau montant versé'), '45000');
    fireEvent.changeText(screen.getByLabelText('Motif de la demande'), 'Erreur de saisie');
    fireEvent.press(screen.getByText('Envoyer la demande'));
    expect(muts.useCreerDemandeModif.mutate.mock.calls[0][0]).toEqual({
      versementId: 'v1',
      payloadModif: { montantVerse: 45000 },
      motifDemande: 'Erreur de saisie',
    });
    expect(retourParent).toHaveBeenCalled();
    expect(dialog.success).toHaveBeenCalledWith('Demande de modification envoyée', 'Le livreur doit l’approuver.');
  });

  it('demander une modification : versement introuvable', () => {
    mockParams = { versementId: 'inconnu' };
    render(<DemanderModifFournisseur />);
    expect(screen.getByText('Versement introuvable')).toBeTruthy();
  });

  it('reversements : à reverser du mois, reverser (montant proposé = net), total sans les lignes informatives', () => {
    render(<ReversementsFournisseur />);
    expect(screen.getAllByText('6 000 F').length).toBeGreaterThan(0);
    expect(screen.getByText('Remise du mois 8 000 F · dette 2 000 F')).toBeTruthy();
    // Net nul : bouton inactif.
    expect(screen.getByLabelText('Reverser à Marc Konan').props.accessibilityState).toEqual({ disabled: true });
    // Total : 3 000 (la ligne informative de 1 000 ne compte pas).
    expect(screen.getAllByText('3 000 F')).toHaveLength(2);
    expect(screen.getByText('1 000 F')).toBeTruthy();
    expect(screen.getByText('Information (saisi par le livreur)')).toBeTruthy();
    expect(screen.getByText(/^02 oct.? 2026 · septembre 2026$/)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Reverser à Awa Yao'));
    expect(screen.getByLabelText('Montant du reversement').props.value).toBe('6000');
    fireEvent.changeText(screen.getByLabelText('Montant du reversement'), '7000');
    expect(screen.getByText('Montant supérieur au net à reverser')).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Montant du reversement'), '0');
    fireEvent.press(screen.getByLabelText('Confirmer le reversement'));
    expect(dialog.warning).toHaveBeenCalledWith('Montant invalide', 'Saisis un montant supérieur à 0.');
    fireEvent.changeText(screen.getByLabelText('Montant du reversement'), '6000');
    fireEvent.press(screen.getByLabelText('Confirmer le reversement'));
    const [annee, mois] = moisDe().split('-').map(Number);
    expect(muts.useEnregistrerReversementFournisseur.mutate.mock.calls[0][0]).toEqual({
      type: 'FOURNISSEUR',
      beneficiaireId: 'l1',
      montant: 6000,
      mois,
      annee,
    });
    expect(dialog.success).toHaveBeenCalledWith('Reversement enregistré');
  });

  it('reversements : rien à reverser, historique vide, erreur', () => {
    m('useReversementsSyntheseFournisseur').mockReturnValue(lecture({ annee: 2026, mois: 10, aReverserAuxLivreurs: [] }));
    m('useReversementsFournisseur').mockReturnValue(lecture([]));
    const { unmount } = render(<ReversementsFournisseur />);
    expect(screen.getByText('Rien à reverser')).toBeTruthy();
    expect(screen.getByText('Pas encore de reversement effectué.')).toBeTruthy();
    unmount();
    m('useReversementsSyntheseFournisseur').mockReturnValue(
      lecture(undefined, { isError: true, error: erreurBack('Synthèse indisponible') }),
    );
    render(<ReversementsFournisseur />);
    expect(screen.getByText('Synthèse indisponible')).toBeTruthy();
  });

  it('reversements : hors ligne, confirmation désactivée', () => {
    mockEnLigne = false;
    render(<ReversementsFournisseur />);
    fireEvent.press(screen.getByLabelText('Reverser à Awa Yao'));
    fireEvent.press(screen.getByLabelText('Confirmer le reversement'));
    expect(muts.useEnregistrerReversementFournisseur.mutate).not.toHaveBeenCalled();
  });

  it('dépenses : les siennes, sans sélecteur d’équipe ; « Nouvelle » ouvre la saisie du fournisseur', () => {
    render(<DepensesFournisseur />);
    expect(screen.getByText('Mes dépenses')).toBeTruthy();
    expect(screen.queryByText('Dépenses de')).toBeNull();
    expect(screen.getByText('Plein gasoil')).toBeTruthy();
    expect(mdep('useDepenses')).toHaveBeenCalledWith(undefined, undefined, { type: 'moi' });
    fireEvent.press(screen.getByText('Nouvelle'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/argent/depenses/nouvelle');
  });

  it('nouvelle dépense : enregistrée une fois, puis retour à la liste', () => {
    render(<NouvelleDepenseFournisseur />);
    fireEvent.changeText(screen.getByPlaceholderText('Ex : Plein gasoil'), 'Vidange');
    fireEvent.changeText(screen.getByPlaceholderText('0'), '12000');
    fireEvent.press(screen.getByText('Enregistrer'));
    expect(muts.useCreateDepense.mutate).toHaveBeenCalledTimes(1);
    expect(muts.useCreateDepense.mutate.mock.calls[0][0]).toEqual(
      expect.objectContaining({ libelle: 'Vidange', categorie: 'CARBURANT', montant: 12000 }),
    );
    expect(retourParent).toHaveBeenCalled();
  });
});

describe('FM3 : catalogue du fournisseur (Moi)', () => {
  it('liste : actifs par défaut, filtres, prix et prix particuliers ; ajouter et modifier', () => {
    render(<CatalogueFournisseur />);
    expect(screen.getByText('Pain')).toBeTruthy();
    expect(screen.getByText('250 F')).toBeTruthy();
    expect(screen.getByText('2 prix particuliers')).toBeTruthy();
    expect(screen.queryByText('Baguette')).toBeNull();
    fireEvent.press(screen.getByText('Inactifs'));
    expect(screen.getByText('Baguette')).toBeTruthy();
    expect(screen.getByText(/^Inactif depuis le 01 oct.? 2026$/)).toBeTruthy();
    fireEvent.press(screen.getByText('Tous'));
    expect(screen.getByText('Pain')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Modifier Pain'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/moi/catalogue/pf1');
    fireEvent.press(screen.getByLabelText('Ajouter un produit'));
    expect(naviguer).toHaveBeenLastCalledWith('/fournisseur/moi/catalogue/ajouter');
  });

  it('désactiver après confirmation (texte du web) ; réactiver au prix de la ligne', async () => {
    render(<CatalogueFournisseur />);
    fireEvent.press(screen.getByLabelText('Désactiver Pain'));
    const options = await confirmer();
    expect(options.title).toBe('Désactiver « Pain » ?');
    expect(options.message).toMatch(/ne pourra plus être commandé chez toi/);
    expect(muts.useDesactiverLigneCatalogue.mutate.mock.calls[0][0]).toBe('pf1');
    fireEvent.press(screen.getByText('Tous'));
    fireEvent.press(screen.getByLabelText('Réactiver Baguette'));
    const options2 = await confirmer();
    expect(options2.message).toMatch(/au prix de 150 F/);
    expect(muts.useReactiverLigneCatalogue.mutate.mock.calls[0][0]).toEqual({ pfId: 'pf2' });
  });

  it('vide, erreur, hors ligne', () => {
    m('useCatalogueFournisseur').mockReturnValue(lecture([]));
    const { unmount } = render(<CatalogueFournisseur />);
    expect(screen.getByText('Aucun produit au catalogue')).toBeTruthy();
    unmount();
    m('useCatalogueFournisseur').mockReturnValue(lecture(undefined, { isError: true, error: erreurBack('Indisponible') }));
    const r2 = render(<CatalogueFournisseur />);
    expect(screen.getByText('Indisponible')).toBeTruthy();
    r2.unmount();
    m('useCatalogueFournisseur').mockReturnValue(lecture([ligne({})]));
    mockEnLigne = false;
    render(<CatalogueFournisseur />);
    fireEvent.press(screen.getByLabelText('Désactiver Pain'));
    expect(dialog.confirm).not.toHaveBeenCalled();
  });

  it('ajouter depuis la liste : déjà actif grisé, nouveau produit avec son prix', () => {
    render(<AjouterProduitCatalogue />);
    expect(screen.getByText('Déjà dans ton catalogue')).toBeTruthy();
    expect(screen.getByText('Inactif chez toi')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Choisir Croissant'));
    fireEvent.press(screen.getByLabelText('Ajouter'));
    expect(screen.getByText('Le prix de vente doit être supérieur à 0.')).toBeTruthy();
    expect(muts.useActiverProduitCatalogue.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Prix de vente au livreur'), '300');
    fireEvent.press(screen.getByLabelText('Ajouter'));
    expect(muts.useActiverProduitCatalogue.mutate.mock.calls[0][0]).toEqual({ produitId: 'p3', prixDeVente: 300 });
    expect(dialog.success).toHaveBeenCalledWith('Produit ajouté à ton catalogue');
    expect(retourParent).toHaveBeenCalled();
  });

  it('ajouter un produit inactif chez lui : réactivé avec le prix saisi', () => {
    render(<AjouterProduitCatalogue />);
    fireEvent.press(screen.getByLabelText('Choisir Baguette'));
    expect(screen.getByLabelText('Prix de vente au livreur').props.value).toBe('150');
    fireEvent.changeText(screen.getByLabelText('Prix de vente au livreur'), '175');
    fireEvent.press(screen.getByLabelText('Réactiver'));
    expect(muts.useReactiverLigneCatalogue.mutate.mock.calls[0][0]).toEqual({ pfId: 'pf2', prixDeVente: 175 });
  });

  it('créer un produit : doublon signalé, désignation contrôlée, message du back tel quel', () => {
    muts.useCreerEtActiverProduit = mutation(erreurBack('Désignation déjà utilisée'));
    render(<AjouterProduitCatalogue />);
    fireEvent.press(screen.getByText('Créer un nouveau produit'));
    fireEvent.changeText(screen.getByLabelText('Désignation'), ' croissant ');
    expect(screen.getByText('Ce produit existe déjà : ajoute-le depuis la liste.')).toBeTruthy();
    expect(screen.getByLabelText('Créer').props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.changeText(screen.getByLabelText('Désignation'), 'P');
    fireEvent.changeText(screen.getByLabelText('Prix de vente au livreur'), '300');
    fireEvent.press(screen.getByLabelText('Créer'));
    expect(screen.getByText(/La désignation doit contenir de 2 à 100 caractères/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Désignation'), '  Pain   maison ');
    fireEvent.press(screen.getByLabelText('Créer'));
    expect(muts.useCreerEtActiverProduit.mutate.mock.calls[0][0]).toEqual({ designation: 'Pain maison', prixDeVente: 300 });
    expect(dialog.error).toHaveBeenCalledWith('Erreur', 'Désignation déjà utilisée');
  });

  it('modifier : désignation (renommable) puis prix ; échec partiel expliqué', async () => {
    mockParams = { id: 'pf1' };
    muts.useModifierLigneCatalogue = mutation(erreurBack('Prix refusé par le serveur'));
    render(<ModifierProduitCatalogue />);
    fireEvent.changeText(screen.getByLabelText('Désignation'), 'Pain complet');
    fireEvent.changeText(screen.getByLabelText('Prix de vente au livreur'), '275');
    fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(await screen.findByText('Désignation enregistrée ; prix refusé : Prix refusé par le serveur')).toBeTruthy();
    expect(muts.useRenommerProduit.mutateAsync).toHaveBeenCalledWith({ produitId: 'p1', designation: 'Pain complet' });
    expect(muts.useModifierLigneCatalogue.mutateAsync).toHaveBeenCalledWith({ pfId: 'pf1', prixDeVente: 275 });
    // Nouvel essai : seul le prix est renvoyé.
    muts.useModifierLigneCatalogue.mutateAsync.mockResolvedValueOnce({});
    fireEvent.press(screen.getByLabelText('Enregistrer'));
    await screen.findByLabelText('Enregistrer');
    await Promise.resolve();
    expect(muts.useRenommerProduit.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it('modifier : non renommable, désignation en lecture seule ; rien de changé = retour', () => {
    mockParams = { id: 'pf2' };
    render(<ModifierProduitCatalogue />);
    expect(screen.getByText(/sa désignation n'est pas modifiable/)).toBeTruthy();
    expect(screen.queryByLabelText('Désignation')).toBeNull();
    expect(screen.getByText('Produit inactif : ce prix s’appliquera à la réactivation.')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Enregistrer'));
    expect(retourParent).toHaveBeenCalled();
    expect(muts.useModifierLigneCatalogue.mutateAsync).not.toHaveBeenCalled();
  });

  it('modifier : produit introuvable', () => {
    mockParams = { id: 'inconnu' };
    render(<ModifierProduitCatalogue />);
    expect(screen.getByText('Produit introuvable')).toBeTruthy();
  });
});
