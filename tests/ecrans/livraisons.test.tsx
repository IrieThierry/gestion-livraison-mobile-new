import { fireEvent, render, screen } from '@testing-library/react-native';
import { naviguer } from '../../lib/navigation-app';
import LivraisonsList from '../../app/(livreur)/livraisons/index';
import { useLivraisonsLivreurPeriode } from '../../features/livraisons/hooks';
import { aujourdhui, derniersJours, jourIso, libelleIntervalle } from '../../lib/periode';

jest.mock('expo-router', () => ({
  usePathname: () => '/',
  router: { push: jest.fn(), back: jest.fn(), navigate: jest.fn() },
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
jest.mock('../../stores/authStore', () => {
  const user = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null };
  return { useAuthStore: (sel: (s: unknown) => unknown) => sel({ user }) };
});
jest.mock('../../features/livraisons/hooks', () => ({ useLivraisonsLivreurPeriode: jest.fn() }));
// Calendrier simulé : un appui choisit le jour d'il y a 3 jours.
jest.mock('@react-native-community/datetimepicker', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ onChange }: { onChange: (e: { type: string }, d: Date) => void }) => {
      const d = new Date();
      d.setDate(d.getDate() - 3);
      return <Text onPress={() => onChange({ type: 'set' }, d)}>calendrier</Text>;
    },
  };
});

const hook = useLivraisonsLivreurPeriode as jest.Mock;
const lecture = (data: unknown[]) => ({ data, isLoading: false, isFetching: false, refetch: jest.fn() });

const livraison = (id: string, date: string, encaissee: boolean, nom: string) => ({
  id,
  reference: `LIV-${id}`,
  date,
  client: { id: `c-${id}`, prenom: '', nom, quartier: null },
  livreur: { id: 'liv-1' },
  produitsLivraison: [],
  statut: 'LIVREE',
  statutEncaissement: encaissee ? 'ENCAISSEE' : 'NON_ENCAISSEE',
  montantLivre: 1000,
  montantDu: 1000,
  remiseNette: 0,
  avecRemise: false,
  montantPaye: encaissee ? 1000 : 0,
  resteDu: encaissee ? 0 : 1000,
  entierementPayee: encaissee,
  encaissementReferences: [],
});

beforeEach(() => {
  jest.clearAllMocks();
  hook.mockReturnValue(lecture([]));
});

describe('Mes livraisons', () => {
  it('bouton « Nouvelle livraison » vers le formulaire', () => {
    render(<LivraisonsList />);
    fireEvent.press(screen.getByLabelText('Nouvelle livraison'));
    expect(naviguer).toHaveBeenCalledWith('/(livreur)/livraisons/nouvelle');
  });

  it("pastilles Aujourd'hui (défaut) / 7 j / 30 j / Période… ; la période part à la route", () => {
    render(<LivraisonsList />);
    for (const l of ["Aujourd'hui", '7 j', '30 j', 'Période…']) expect(screen.getByText(l)).toBeTruthy();
    expect(screen.queryByText('Tous')).toBeNull();
    expect(hook).toHaveBeenLastCalledWith('liv-1', aujourdhui());

    fireEvent.press(screen.getByText('7 j'));
    expect(hook).toHaveBeenLastCalledWith('liv-1', derniersJours(7));
    fireEvent.press(screen.getByText('30 j'));
    expect(hook).toHaveBeenLastCalledWith('liv-1', derniersJours(30));
  });

  it('la période filtre la liste, les compteurs et la recherche', () => {
    const { debut, fin } = derniersJours(7);
    hook.mockReturnValue(
      lecture([
        livraison('1', `${fin}T09:00:00`, true, 'Boutique Awa'),
        livraison('2', `${debut}T10:00:00`, false, 'Chez Koffi'),
        // Hors période (le back ne devrait pas la renvoyer) : ignorée.
        livraison('3', '2001-01-01T10:00:00', false, 'Ancien'),
      ]),
    );
    render(<LivraisonsList />);
    fireEvent.press(screen.getByText('7 j'));
    expect(screen.getByText('2 livraisons')).toBeTruthy();
    expect(screen.queryByText(/Ancien/)).toBeNull();
    // Compteurs sur la période seulement.
    expect(screen.getByLabelText('Encaissée : 1')).toBeTruthy();
    expect(screen.getByLabelText('Non encaissée : 1')).toBeTruthy();
    expect(screen.getByLabelText(/^Reste dû : 1.000$/)).toBeTruthy();
    // Recherche dans la période.
    fireEvent.press(screen.getByLabelText('Rechercher'));
    fireEvent.changeText(screen.getByPlaceholderText('Rechercher un client ou quartier…'), 'Koffi');
    expect(screen.getByText('1 livraison')).toBeTruthy();
    expect(screen.getByLabelText('Encaissée : 0')).toBeTruthy();
    expect(screen.getByLabelText('Non encaissée : 1')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('Rechercher un client ou quartier…'), 'Ancien');
    expect(screen.getByText('0 livraison')).toBeTruthy();
  });

  it('Période… : Du / Au choisis, envoyés à la route, pastille de l’intervalle, croix → Aujourd’hui', () => {
    render(<LivraisonsList />);
    fireEvent.press(screen.getByText('Période…'));
    const aujourd = jourIso(new Date());
    const ilYa3 = new Date();
    ilYa3.setDate(ilYa3.getDate() - 3);
    const du = jourIso(ilYa3);
    fireEvent.press(screen.getByLabelText(/^Du /));
    fireEvent.press(screen.getByText('calendrier'));
    fireEvent.press(screen.getByText('Appliquer'));
    expect(hook).toHaveBeenLastCalledWith('liv-1', { debut: du, fin: aujourd });
    expect(screen.getByText(libelleIntervalle(du, aujourd))).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Effacer la période'));
    expect(hook).toHaveBeenLastCalledWith('liv-1', aujourdhui());
  });
});
