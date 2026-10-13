import { fireEvent, render, screen } from '@testing-library/react-native';
import { ouvrir } from '../../lib/navigation-app';
import { FabSheet } from '../../components/livreur/FabSheet';
import { entreesAccederA } from '../../lib/acceder-a';

jest.mock('expo-router', () => ({ usePathname: () => '/',
  router: { push: jest.fn() } }));
jest.mock('../../lib/navigation-app', () => ({
  ouvrir: jest.fn(),
  naviguer: jest.fn(),
  revenirA: jest.fn(),
  retourParent: jest.fn(),
  revenirApresEnregistrement: jest.fn(),
  origineDe: jest.fn(() => null),
}));
let mockUser: { id: string; parentId: string | null } | null = { id: 'p', parentId: null };
jest.mock('../../stores/authStore', () => ({
  useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: mockUser }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockUser = { id: 'p', parentId: null };
});

describe('entreesAccederA', () => {
  it('livreur principal : les 7 listes dans l’ordre', () => {
    expect(entreesAccederA({ parentId: null }).map((e) => [e.label, e.chemin])).toEqual([
      ['Mes livraisons', '/(livreur)/livraisons'],
      ['Mes clients', '/(livreur)/clients'],
      ['Mes encaissements', '/(livreur)/cash/encaissements'],
      ['Mes versements', '/(livreur)/cash/versements'],
      ['Commandes', '/(livreur)/cash/commandes'],
      ['Retours produits', '/(livreur)/cash/retours'],
      ['Prévisions', '/(livreur)/previsions'],
    ]);
  });

  it('apprenti : pas de versements, commandes à réceptionner, pas de Dépenses / Reversements / Clôtures', () => {
    const entrees = entreesAccederA({ parentId: 'p' });
    expect(entrees.map((e) => e.label)).toEqual([
      'Mes livraisons',
      'Mes clients',
      'Mes encaissements',
      'Commandes',
      'Retours produits',
      'Prévisions',
    ]);
    expect(entrees.find((e) => e.cle === 'commandes')?.chemin).toBe('/(livreur)/cash/commandes/a-receptionner');
  });

  it('commercial d’organisation : ni versements ni commandes fournisseur', () => {
    const entrees = entreesAccederA({ parentId: 'r', organisationId: 'o1', organisationRole: 'COMMERCIAL' });
    expect(entrees.map((e) => e.label)).toEqual([
      'Mes livraisons',
      'Mes clients',
      'Mes encaissements',
      'Retours produits',
      'Prévisions',
    ]);
    const responsable = entreesAccederA({ parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' });
    expect(responsable.some((e) => e.cle === 'versements' || e.cle === 'commandes')).toBe(false);
  });
});

describe('FabSheet « Accéder à »', () => {
  it('titre, 7 entrées, un appui ferme la feuille et ouvre la liste sur une pile propre', () => {
    const onClose = jest.fn();
    render(<FabSheet open onClose={onClose} />);
    expect(screen.getByText('Accéder à')).toBeTruthy();
    expect(screen.queryByText('Créer')).toBeNull();
    expect(screen.getAllByRole('button').filter((b) => b.props.accessibilityLabel !== 'Fermer')).toHaveLength(7);

    fireEvent.press(screen.getByLabelText('Mes versements'));
    expect(onClose).toHaveBeenCalled();
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/versements');
  });

  it('apprenti : 6 entrées, Commandes → à réceptionner', () => {
    mockUser = { id: 'a', parentId: 'p' };
    render(<FabSheet open onClose={jest.fn()} />);
    expect(screen.queryByLabelText('Mes versements')).toBeNull();
    fireEvent.press(screen.getByLabelText('Commandes'));
    expect(ouvrir).toHaveBeenCalledWith('/(livreur)/cash/commandes/a-receptionner');
  });
});
