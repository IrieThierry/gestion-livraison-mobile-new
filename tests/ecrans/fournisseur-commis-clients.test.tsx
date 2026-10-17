import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';
import CommisFournisseur from '../../app/fournisseur/moi/commis/index';
import NouveauCommis from '../../app/fournisseur/moi/commis/nouveau';
import ModifierCommis from '../../app/fournisseur/moi/commis/[id]';
import ClientsFournisseur from '../../app/fournisseur/argent/clients/index';
import NouveauClient from '../../app/fournisseur/argent/clients/nouveau';
import FicheClient from '../../app/fournisseur/argent/clients/[id]/index';
import PrixClient from '../../app/fournisseur/argent/clients/[id]/prix';
import VersementClient from '../../app/fournisseur/argent/clients/[id]/versement';
import Recapitulatif from '../../app/fournisseur/recapitulatif';
import { DatePickerField } from '../../components/shared/DatePickerField';
import * as commis from '../../features/fournisseur/commis';
import * as clients from '../../features/fournisseur/clients';
import * as recap from '../../features/fournisseur/recapitulatif';
import * as hooksFournisseur from '../../features/fournisseur/hooks';
import { dialog } from '../../lib/dialog';
import { naviguer } from '../../lib/navigation-app';
import { formatFCFA, formatMontant } from '../../lib/format';
import { jourIso } from '../../lib/periode';

let mockParams: Record<string, string> = {};
jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('expo-router', () => ({
  usePathname: () => '/fournisseur/argent/clients/k1',
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
jest.mock('../../features/fournisseur/commis', () => ({
  ...jest.requireActual('../../features/fournisseur/commis'),
  useCommisFournisseur: jest.fn(),
  useDemandesMotDePasseCommis: jest.fn(),
  useCreerCommis: jest.fn(),
  useModifierCommis: jest.fn(),
  useBasculerCommis: jest.fn(),
  useReinitialiserMotDePasseCommis: jest.fn(),
  useIgnorerDemandeCommis: jest.fn(),
}));
jest.mock('../../features/fournisseur/clients', () => ({
  ...jest.requireActual('../../features/fournisseur/clients'),
  useClientsFournisseur: jest.fn(),
  useCreerClientFournisseur: jest.fn(),
  useModifierClientFournisseur: jest.fn(),
  usePrixClient: jest.fn(),
  useFixerPrixClient: jest.fn(),
  useRetirerPrixClient: jest.fn(),
  useSituationClient: jest.fn(),
  useEnregistrerVersementClient: jest.fn(),
  useAnnulerSortieClient: jest.fn(),
}));
jest.mock('../../features/fournisseur/recapitulatif', () => ({
  ...jest.requireActual('../../features/fournisseur/recapitulatif'),
  useRecapitulatifRemises: jest.fn(),
}));
jest.mock('../../features/fournisseur/hooks', () => ({
  useLivreursPartenaires: jest.fn(),
}));

const cm = (n: keyof typeof commis) => commis[n] as unknown as jest.Mock;
const cl = (n: keyof typeof clients) => clients[n] as unknown as jest.Mock;
const rc = (n: keyof typeof recap) => recap[n] as unknown as jest.Mock;

const lecture = (data: unknown) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
});
const mutation = () => ({ mutate: jest.fn(), isPending: false });

const AWA = { id: 'c1', nom: 'Koné', prenom: 'Awa', contact: '0701020304', username: 'awa', actif: true, photoUrl: null };
const BOUBA = { ...AWA, id: 'c2', nom: 'Diop', prenom: 'Bouba', username: 'bouba', actif: false };
const BOUTIQUE = { id: 'k1', nom: 'BOUTIQUE AWA', contact: '0701020304', actif: true, du: 12500 };
const SOLDEE = { id: 'k2', nom: 'CHEZ PAUL', contact: null, actif: true, du: 0 };

let mutations: Record<string, ReturnType<typeof mutation>>;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { id: 'k1' };
  mockEnLigne = true;
  mutations = {};
  for (const [lib, hooks] of [
    [commis, ['useCreerCommis', 'useModifierCommis', 'useBasculerCommis', 'useReinitialiserMotDePasseCommis', 'useIgnorerDemandeCommis']],
    [clients, ['useCreerClientFournisseur', 'useModifierClientFournisseur', 'useFixerPrixClient', 'useRetirerPrixClient', 'useEnregistrerVersementClient', 'useAnnulerSortieClient']],
  ] as const) {
    for (const h of hooks) {
      mutations[h] = mutation();
      (lib as unknown as Record<string, jest.Mock>)[h].mockReturnValue(mutations[h]);
    }
  }
  cm('useCommisFournisseur').mockReturnValue(lecture([AWA, BOUBA]));
  cm('useDemandesMotDePasseCommis').mockReturnValue(lecture([{ id: 'd1', compteId: 'c1', statut: 'EN_ATTENTE' }]));
  cl('useClientsFournisseur').mockReturnValue(lecture([BOUTIQUE, SOLDEE]));
  (hooksFournisseur.useLivreursPartenaires as unknown as jest.Mock).mockReturnValue(
    lecture([{ livreur: { id: 'l1', nom: 'Yao', prenom: 'Awa' } }]),
  );
});

describe('Mes commis (mobile)', () => {
  it('liste les commis, signale la demande de mot de passe et le compte désactivé', () => {
    render(<CommisFournisseur />);
    expect(screen.getByText('Awa Koné')).toBeTruthy();
    expect(screen.getByText('Bouba Diop')).toBeTruthy();
    expect(screen.getAllByText('Mot de passe demandé')).toHaveLength(1);
    expect(screen.getAllByText('DÉSACTIVÉ')).toHaveLength(1);
    fireEvent.press(screen.getByLabelText('Nouveau commis'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/moi/commis/nouveau');
    fireEvent.press(screen.getByLabelText('Modifier Awa Koné'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/moi/commis/c1');
  });

  it('désactiver demande confirmation, puis envoie une seule fois', () => {
    render(<CommisFournisseur />);
    fireEvent.press(screen.getByLabelText('Désactiver Awa Koné'));
    const c = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(c.destructive).toBe(true);
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(mutations.useBasculerCommis.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useBasculerCommis.mutate.mock.calls[0][0]).toEqual({ id: 'c1', actif: false });
  });

  it('réactiver un commis désactivé', () => {
    render(<CommisFournisseur />);
    fireEvent.press(screen.getByLabelText('Réactiver Bouba Diop'));
    act(() => (dialog.confirm as jest.Mock).mock.calls[0][0].onConfirm());
    expect(mutations.useBasculerCommis.mutate.mock.calls[0][0]).toEqual({ id: 'c2', actif: true });
  });

  it('réinitialiser : mot de passe provisoire affiché une fois, avec une action Copier', () => {
    const partage = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as never);
    render(<CommisFournisseur />);
    fireEvent.press(screen.getByLabelText('Réinitialiser le mot de passe de Awa Koné'));
    const c = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(c.message).toContain('appelle-le au numéro de son compte');
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(mutations.useReinitialiserMotDePasseCommis.mutate).toHaveBeenCalledTimes(1);
    const [id, opts] = mutations.useReinitialiserMotDePasseCommis.mutate.mock.calls[0];
    expect(id).toBe('c1');
    act(() => {
      opts.onSuccess({ tempPassword: 'Xy7kP2qa' });
      opts.onSettled();
    });
    const [titre, message, options] = (dialog.info as jest.Mock).mock.calls[0];
    expect(titre).toBe('Mot de passe provisoire');
    expect(message).toContain('Xy7kP2qa');
    expect(options.autoDismissMs).toBe(0);
    const copier = options.actions.find((a: { label: string }) => a.label === 'Copier');
    copier.onPress();
    expect(partage).toHaveBeenCalledWith({ message: 'Xy7kP2qa' });
  });

  it('ignorer une demande en attente', () => {
    render(<CommisFournisseur />);
    fireEvent.press(screen.getByLabelText('Ignorer la demande de Awa Koné'));
    act(() => (dialog.confirm as jest.Mock).mock.calls[0][0].onConfirm());
    expect(mutations.useIgnorerDemandeCommis.mutate.mock.calls[0][0]).toBe('d1');
  });
});

describe('Nouveau commis (mobile)', () => {
  const saisir = (contact: string) => {
    fireEvent.changeText(screen.getByLabelText('Prénom'), 'Awa');
    fireEvent.changeText(screen.getByLabelText('Nom'), 'Koné');
    fireEvent.changeText(screen.getByLabelText('Téléphone'), contact);
    fireEvent.changeText(screen.getByLabelText("Nom d'utilisateur"), 'Awa.Kone');
    fireEvent.changeText(screen.getByLabelText('Mot de passe provisoire'), 'secret1');
  };

  it('téléphone invalide : message, aucun envoi', () => {
    render(<NouveauCommis />);
    saisir('0612345678');
    fireEvent.press(screen.getByLabelText('Créer le commis'));
    expect(dialog.warning).toHaveBeenCalledWith('Champ invalide', 'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.');
    expect(mutations.useCreerCommis.mutate).not.toHaveBeenCalled();
  });

  it('création : identifiant en minuscules, envoi unique malgré un double appui', () => {
    render(<NouveauCommis />);
    saisir('0701020304');
    fireEvent.press(screen.getByLabelText('Créer le commis'));
    fireEvent.press(screen.getByLabelText('Créer le commis'));
    expect(mutations.useCreerCommis.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useCreerCommis.mutate.mock.calls[0][0]).toEqual({
      prenom: 'Awa',
      nom: 'Koné',
      contact: '0701020304',
      username: 'awa.kone',
      password: 'secret1',
    });
  });
});

describe('Modifier un commis (mobile)', () => {
  beforeEach(() => {
    mockParams = { id: 'c1' };
  });

  it('formulaire prérempli sans mot de passe ; téléphone invalide : message, aucun envoi', () => {
    render(<ModifierCommis />);
    expect(screen.getByLabelText('Prénom').props.value).toBe('Awa');
    expect(screen.getByLabelText("Nom d'utilisateur").props.value).toBe('awa');
    expect(screen.queryByLabelText('Mot de passe provisoire')).toBeNull();
    fireEvent.changeText(screen.getByLabelText('Téléphone'), '0612345678');
    fireEvent.press(screen.getByLabelText('Enregistrer le commis'));
    expect(dialog.warning).toHaveBeenCalledWith('Champ invalide', 'Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.');
    expect(mutations.useModifierCommis.mutate).not.toHaveBeenCalled();
  });

  it('modification : PUT identité, identifiant en minuscules, envoi unique malgré un double appui', () => {
    render(<ModifierCommis />);
    fireEvent.changeText(screen.getByLabelText('Téléphone'), '0501020304');
    fireEvent.changeText(screen.getByLabelText("Nom d'utilisateur"), ' Awa.Kone ');
    fireEvent.press(screen.getByLabelText('Enregistrer le commis'));
    fireEvent.press(screen.getByLabelText('Enregistrer le commis'));
    expect(mutations.useModifierCommis.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useModifierCommis.mutate.mock.calls[0][0]).toEqual({
      id: 'c1',
      payload: { prenom: 'Awa', nom: 'Koné', contact: '0501020304', username: 'awa.kone' },
    });
  });

  it('commis inconnu : « Commis introuvable. »', () => {
    mockParams = { id: 'zz' };
    render(<ModifierCommis />);
    expect(screen.getByText('Commis introuvable.')).toBeTruthy();
  });
});

describe('Mes clients (mobile)', () => {
  it('dû en rouge quand il est positif, neutre à zéro', () => {
    render(<ClientsFournisseur />);
    expect(screen.getByText('BOUTIQUE AWA')).toBeTruthy();
    expect(screen.getByLabelText('Dû de BOUTIQUE AWA').props.className).toContain('text-red');
    expect(screen.getByLabelText('Dû de CHEZ PAUL').props.className).not.toContain('text-red');
    expect(screen.getByText(`${formatFCFA(12500)} F`)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Nouveau client'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/argent/clients/nouveau');
    fireEvent.press(screen.getByLabelText('Ouvrir BOUTIQUE AWA'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/argent/clients/k1');
  });

  it('nouveau client : nom obligatoire, puis envoi unique', () => {
    render(<NouveauClient />);
    fireEvent.press(screen.getByLabelText('Enregistrer le client'));
    expect(dialog.warning).toHaveBeenCalledWith('Champ invalide', 'Le nom du client est obligatoire.');
    fireEvent.changeText(screen.getByLabelText('Nom du client'), 'Boutique Awa');
    fireEvent.press(screen.getByLabelText('Enregistrer le client'));
    fireEvent.press(screen.getByLabelText('Enregistrer le client'));
    expect(mutations.useCreerClientFournisseur.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useCreerClientFournisseur.mutate.mock.calls[0][0]).toEqual({ nom: 'Boutique Awa', contact: '' });
  });
});

describe('Prix du client (mobile)', () => {
  const lignes = [
    { produitFournisseurId: 'pf1', designation: 'Baguette', photoUrl: null, prixCatalogue: 300, prixClient: 250 },
    { produitFournisseurId: 'pf2', designation: 'Pain de mie', photoUrl: null, prixCatalogue: 500, prixClient: null },
  ];

  it('affiche le prix du client ou signale le prix du catalogue appliqué', () => {
    cl('usePrixClient').mockReturnValue(lecture(lignes));
    render(<PrixClient />);
    expect(screen.getByLabelText('Prix de Baguette pour ce client').props.value).toBe('250');
    expect(screen.getByLabelText('Prix de Pain de mie pour ce client').props.value).toBe('');
    // Prix propre signalé comme tel ; sans prix propre, le prix du catalogue s'applique.
    expect(screen.getAllByText('Prix du catalogue appliqué')).toHaveLength(1);
    expect(screen.getByText('Prix propre à ce client')).toBeTruthy();
    expect(screen.getByText(`Catalogue : ${formatMontant(300)} F`)).toBeTruthy();
    expect(screen.getByText(`Catalogue : ${formatMontant(500)} F`)).toBeTruthy();
  });

  it('enregistrer un prix valide, refuser 0', () => {
    cl('usePrixClient').mockReturnValue(lecture(lignes));
    render(<PrixClient />);
    fireEvent.changeText(screen.getByLabelText('Prix de Pain de mie pour ce client'), '0');
    fireEvent.press(screen.getByLabelText('Enregistrer le prix de Pain de mie'));
    expect(screen.getByText('Le prix doit être supérieur à 0.')).toBeTruthy();
    expect(mutations.useFixerPrixClient.mutate).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('Prix de Pain de mie pour ce client'), '450');
    fireEvent.press(screen.getByLabelText('Enregistrer le prix de Pain de mie'));
    fireEvent.press(screen.getByLabelText('Enregistrer le prix de Pain de mie'));
    expect(mutations.useFixerPrixClient.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useFixerPrixClient.mutate.mock.calls[0][0]).toEqual({ clientId: 'k1', pfId: 'pf2', prix: 450 });
  });

  it('retirer un prix propre', () => {
    cl('usePrixClient').mockReturnValue(lecture(lignes));
    render(<PrixClient />);
    fireEvent.press(screen.getByLabelText('Retirer le prix de Baguette'));
    expect(mutations.useRetirerPrixClient.mutate.mock.calls[0][0]).toEqual({ clientId: 'k1', pfId: 'pf1' });
  });
});

describe('Versement d’un client (mobile)', () => {
  beforeEach(() => cl('useClientsFournisseur').mockReturnValue(lecture([BOUTIQUE, SOLDEE])));

  it('montant nul refusé', () => {
    render(<VersementClient />);
    fireEvent.changeText(screen.getByLabelText('Montant du versement'), '0');
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(dialog.warning).toHaveBeenCalledWith('Champ invalide', 'Le montant doit être supérieur à 0.');
    expect(mutations.useEnregistrerVersementClient.mutate).not.toHaveBeenCalled();
  });

  it('date du versement bornée à aujourd’hui (le back refuse une date future)', () => {
    render(<VersementClient />);
    const max = screen.UNSAFE_getByType(DatePickerField).props.maximumDate as Date;
    expect(jourIso(max)).toBe(jourIso(new Date()));
  });

  it('mode de paiement, commentaire, date du jour, envoi unique', () => {
    render(<VersementClient />);
    for (const label of ['Espèces', 'Mobile Money', 'Virement', 'Autre']) expect(screen.getByText(label)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Montant du versement'), '5000');
    fireEvent.press(screen.getByLabelText('Mode Mobile Money'));
    fireEvent.changeText(screen.getByLabelText('Commentaire'), ' solde du mois ');
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    fireEvent.press(screen.getByLabelText('Enregistrer le versement'));
    expect(mutations.useEnregistrerVersementClient.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useEnregistrerVersementClient.mutate.mock.calls[0][0]).toEqual({
      clientId: 'k1',
      payload: { montant: 5000, date: jourIso(new Date()), mode: 'MOBILE_MONEY', commentaire: 'solde du mois' },
    });
  });
});

describe('Fiche client : sorties et versements (mobile)', () => {
  const situation = {
    client: BOUTIQUE,
    sorties: [
      {
        id: 's1',
        client: { id: 'k1', nom: 'BOUTIQUE AWA' },
        date: '2026-10-16',
        creeLe: '2026-10-16T09:00:00',
        auteur: { id: 'c1', nom: 'Koné', prenom: 'Awa' },
        annulee: false,
        annuleeLe: null,
        lignes: [{ produitFournisseurId: 'pf1', designation: 'Baguette', photoUrl: null, quantite: 10, prixUnitaire: 250, montant: 2500 }],
        montant: 2500,
      },
      {
        id: 's2',
        client: { id: 'k1', nom: 'BOUTIQUE AWA' },
        date: '2026-10-15',
        creeLe: '2026-10-15T09:00:00',
        auteur: { id: 'c1', nom: 'Koné', prenom: 'Awa' },
        annulee: true,
        annuleeLe: '2026-10-15T10:00:00',
        lignes: [{ produitFournisseurId: 'pf1', designation: 'Baguette', photoUrl: null, quantite: 2, prixUnitaire: 250, montant: 500 }],
        montant: 500,
      },
    ],
    versements: [{ id: 'v1', clientId: 'k1', montant: 1000, date: '2026-10-16', mode: 'VIREMENT', commentaire: null, creeLe: '2026-10-16T12:00:00' }],
    totalSorties: 2500,
    totalVerse: 1000,
    du: 1500,
  };

  it('dû, versements avec leur mode, sortie annulée signalée', () => {
    cl('useSituationClient').mockReturnValue(lecture(situation));
    render(<FicheClient />);
    expect(screen.getByLabelText('Dû du client').props.className).toContain('text-red');
    expect(screen.getByText('Virement')).toBeTruthy();
    expect(screen.getByText('Annulée')).toBeTruthy();
    // Seule la sortie non annulée peut être annulée.
    expect(screen.getAllByLabelText(/Annuler la sortie/)).toHaveLength(1);
  });

  it('annuler une sortie : confirmation (irréversible), puis envoi unique', () => {
    cl('useSituationClient').mockReturnValue(lecture(situation));
    render(<FicheClient />);
    fireEvent.press(screen.getAllByLabelText(/Annuler la sortie/)[0]);
    const c = (dialog.confirm as jest.Mock).mock.calls[0][0];
    expect(c.destructive).toBe(true);
    expect(c.message).toContain('irréversible');
    expect(mutations.useAnnulerSortieClient.mutate).not.toHaveBeenCalled();
    act(() => {
      c.onConfirm();
      c.onConfirm();
    });
    expect(mutations.useAnnulerSortieClient.mutate).toHaveBeenCalledTimes(1);
    expect(mutations.useAnnulerSortieClient.mutate.mock.calls[0][0]).toBe('s1');
  });

  it('raccourcis : prix, versement, modification', () => {
    cl('useSituationClient').mockReturnValue(lecture(situation));
    render(<FicheClient />);
    fireEvent.press(screen.getByLabelText('Prix du client'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/argent/clients/k1/prix');
    fireEvent.press(screen.getByLabelText('Enregistrer un versement du client'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/argent/clients/k1/versement');
    fireEvent.press(screen.getByLabelText('Modifier le client'));
    expect(naviguer).toHaveBeenCalledWith('/fournisseur/argent/clients/k1/modifier');
  });
});

describe('Récapitulatif des remises (mobile)', () => {
  const produits = [
    {
      produitFournisseurId: 'p1',
      designation: 'Baguette',
      photoUrl: null,
      totalConfirme: 30,
      totalClients: 5,
      parLivreur: [{ livreurId: 'l1', nom: 'Awa Yao', quantite: 30 }],
      parClient: [{ clientId: 'k1', nom: 'BOUTIQUE AWA', quantite: 5 }],
    },
  ];
  const remise = {
    id: 'r1',
    commandeId: 'cmd1',
    commandeNumero: 'CMDE-1',
    livreur: { id: 'l1', nom: 'Yao', prenom: 'Awa' },
    commis: { id: 'c1', nom: 'Koné', prenom: 'Awa' },
    statut: 'EN_ATTENTE',
    lignes: [{ produitFournisseurId: 'p1', designation: 'Baguette', photoUrl: null, quantite: 4 }],
    creeLe: '2026-10-17T08:00:00',
    reponduLe: null,
    motif: null,
  };

  beforeEach(() => {
    rc('useRecapitulatifRemises').mockReturnValue(lecture({ produits, enAttente: [remise], refusees: [] }));
  });

  it('période du jour par défaut, totaux par produit, remises en attente à part', () => {
    render(<Recapitulatif />);
    const aujourdhui = jourIso(new Date());
    expect(rc('useRecapitulatifRemises').mock.calls[0][0]).toEqual({ debut: aujourdhui, fin: aujourdhui });
    expect(screen.getByText('Baguette')).toBeTruthy();
    expect(screen.getByLabelText('Total remis aux livreurs : Baguette').props.children).toBe(30);
    expect(screen.getByLabelText('Total sorti aux clients : Baguette').props.children).toBe(5);
    expect(screen.getByText('Awa Yao : 30')).toBeTruthy();
    expect(screen.getByText('En attente (1)')).toBeTruthy();
    expect(screen.getByText('Refusées (0)')).toBeTruthy();
  });

  it('le filtre livreur est envoyé au back avec la période', () => {
    render(<Recapitulatif />);
    fireEvent.press(screen.getByText('Tous les livreurs'));
    fireEvent.press(screen.getByText('Awa Yao'));
    const dernier = rc('useRecapitulatifRemises').mock.calls.at(-1)![0];
    expect(dernier.livreurId).toBe('l1');
    expect(dernier.debut).toBe(jourIso(new Date()));
  });

  it('le filtre de période (7 jours) change les bornes envoyées', () => {
    render(<Recapitulatif />);
    fireEvent.press(screen.getByText('7 j'));
    const dernier = rc('useRecapitulatifRemises').mock.calls.at(-1)![0];
    expect(dernier.fin).toBe(jourIso(new Date()));
    expect(dernier.debut < dernier.fin).toBe(true);
  });
});
