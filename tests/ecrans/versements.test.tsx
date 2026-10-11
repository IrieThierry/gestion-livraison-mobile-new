import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import MesVersements from '../../app/(livreur)/cash/versements/index';
import { useVersementsLivreur } from '../../features/versements/hooks';
import type { VersementResponse } from '../../types/api';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), dismissTo: jest.fn(), canGoBack: () => true },
  useNavigation: () => ({ getState: () => undefined }),
}));
let mockUser: { id: string; prenom: string; nom: string; parentId: string | null } = {
  id: 'liv-1',
  prenom: 'Awa',
  nom: 'Kone',
  parentId: null,
};
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));
jest.mock('../../features/versements/hooks', () => ({ useVersementsLivreur: jest.fn() }));

const versements = useVersementsLivreur as jest.Mock;
const lecture = (data: unknown, etat: Record<string, unknown> = {}) => ({
  data,
  isLoading: false,
  isError: false,
  isFetching: false,
  error: null,
  refetch: jest.fn(),
  ...etat,
});
const v = (id: string, date: string, fournisseur: string, montant: number, commentaire: string | null = null) =>
  ({
    id,
    dateVersement: date,
    fournisseur: { id: `f-${fournisseur}`, libelle: fournisseur },
    montantVerse: montant,
    commentaire,
  }) as unknown as VersementResponse;

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'liv-1', prenom: 'Awa', nom: 'Kone', parentId: null };
});

describe('Mes versements', () => {
  const donnees = [
    v('1', '2026-10-02T09:00:00', 'Brasserie du Sud', 15000),
    v('2', '2026-10-05T09:00:00', 'Laiterie Abidjan', 2500, 'Solde septembre'),
  ];

  it('liste les versements du livreur, plus récent en premier, avec le total', () => {
    versements.mockReturnValue(lecture(donnees));
    render(<MesVersements />);
    expect(versements).toHaveBeenCalledWith('liv-1');
    const fournisseurs = screen.getAllByText(/^(Brasserie du Sud|Laiterie Abidjan)$/).map((n) => n.props.children);
    expect(fournisseurs).toEqual(['Laiterie Abidjan', 'Brasserie du Sud']);
    expect(screen.getByText('Total versé')).toBeTruthy();
    expect(screen.getByText(/2 versements · 17\s500 FCFA/)).toBeTruthy();
  });

  it('recherche : liste et total filtrés', () => {
    versements.mockReturnValue(lecture(donnees));
    render(<MesVersements />);
    fireEvent.changeText(screen.getByLabelText('Rechercher un fournisseur, un commentaire…'), 'laiterie');
    expect(screen.queryByText('Brasserie du Sud')).toBeNull();
    expect(screen.getByText(/1 versement · 2\s500 FCFA/)).toBeTruthy();
    fireEvent.changeText(screen.getByLabelText('Rechercher un fournisseur, un commentaire…'), 'introuvable');
    expect(screen.getByText('Aucun résultat')).toBeTruthy();
  });

  it('état vide et bouton « Nouveau versement »', () => {
    versements.mockReturnValue(lecture([]));
    render(<MesVersements />);
    expect(screen.getByText('Aucun versement')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Nouveau versement'));
    expect(router.push).toHaveBeenCalledWith('/(livreur)/cash/versement');
  });

  it('apprenti : aucune lecture, écran réservé au livreur principal', () => {
    mockUser = { ...mockUser, parentId: 'p' };
    versements.mockReturnValue(lecture(undefined));
    render(<MesVersements />);
    expect(versements).toHaveBeenCalledWith(undefined);
    expect(screen.getByText('Réservé au livreur principal')).toBeTruthy();
  });
});
