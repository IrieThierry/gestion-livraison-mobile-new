import { useQueryClient } from '@tanstack/react-query';
import {
  useConfirmerRemiseCommis,
  useRefuserRemiseCommis,
  useRemisesCommisAConfirmer,
  useRemisesCommisDeCommande,
} from './remises';
import {
  cibleRemisesAConfirmer,
  libelleRemisesAConfirmer,
  lireMotifRefus,
  remisesEnAttente,
} from './remises-regles';
import { commandesApi } from './api';
import { commandeKeys } from './keys';
import { stockKeys } from '../stock/keys';
import { useTempsReelConnecte } from '../temps-reel/connexion';
import type { RemiseCommisResponse } from '../../types/api';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn((opts) => opts),
  useMutation: jest.fn((opts) => opts),
  useQueryClient: jest.fn(),
}));
jest.mock('../temps-reel/connexion', () => ({ useTempsReelConnecte: jest.fn(() => false) }));
jest.mock('./api', () => ({
  commandesApi: {
    remisesCommis: jest.fn(),
    remisesAConfirmer: jest.fn(),
    confirmerRemise: jest.fn(),
    refuserRemise: jest.fn(),
  },
}));

const invalidateQueries = jest.fn();
(useQueryClient as jest.Mock).mockReturnValue({ invalidateQueries });
const cles = () => invalidateQueries.mock.calls.map((c) => c[0].queryKey);

const remise = (o: Partial<RemiseCommisResponse> = {}): RemiseCommisResponse => ({
  id: 'r1',
  commandeId: 'c1',
  commandeNumero: 'CMDE-1',
  livreur: { id: 'l1', nom: 'YAO', prenom: 'Koffi' },
  commis: { id: 'k1', nom: 'TRAORÉ', prenom: 'Awa' },
  statut: 'EN_ATTENTE',
  lignes: [{ produitFournisseurId: 'pf1', designation: 'Riz 25 kg', photoUrl: null, quantite: 6 }],
  creeLe: '2026-10-16T09:30:00',
  reponduLe: null,
  motif: null,
  ...o,
});

beforeEach(() => jest.clearAllMocks());

describe('règles des remises du commis (livreur)', () => {
  it('motif du refus : obligatoire, saisi sans espaces autour', () => {
    expect(lireMotifRefus('')).toEqual({ ok: false, erreur: 'Le motif est obligatoire.' });
    expect(lireMotifRefus('   ')).toEqual({ ok: false, erreur: 'Le motif est obligatoire.' });
    expect(lireMotifRefus('  Il manque 2 sacs ')).toEqual({ ok: true, motif: 'Il manque 2 sacs' });
  });

  it('remises en attente seulement', () => {
    const liste = [remise(), remise({ id: 'r2', statut: 'CONFIRMEE' }), remise({ id: 'r3', statut: 'REFUSEE' })];
    expect(remisesEnAttente(liste).map((r) => r.id)).toEqual(['r1']);
    expect(remisesEnAttente(undefined)).toEqual([]);
  });

  it('bandeau : « N remise(s) à confirmer »', () => {
    expect(libelleRemisesAConfirmer(1)).toBe('1 remise à confirmer');
    expect(libelleRemisesAConfirmer(3)).toBe('3 remises à confirmer');
  });

  it('bandeau : une seule commande → son détail ; plusieurs → À réceptionner ; aucune → rien', () => {
    expect(cibleRemisesAConfirmer([])).toBeNull();
    expect(cibleRemisesAConfirmer([remise()])).toBe('/(livreur)/cash/commandes/c1');
    expect(cibleRemisesAConfirmer([remise(), remise({ id: 'r2' })])).toBe('/(livreur)/cash/commandes/c1');
    expect(cibleRemisesAConfirmer([remise(), remise({ id: 'r2', commandeId: 'c2' })])).toBe(
      '/(livreur)/cash/commandes/a-receptionner',
    );
  });
});

describe('hooks des remises du commis (livreur)', () => {
  it('remises d’une commande : clé sous les commandes, désactivées sans id', () => {
    const q = useRemisesCommisDeCommande('c1') as unknown as { queryKey: unknown; enabled: boolean; queryFn: () => void };
    expect(q.queryKey).toEqual(commandeKeys.remisesCommis('c1'));
    expect(q.queryKey).toEqual([...commandeKeys.all, 'remises-commis', 'c1']);
    expect(q.enabled).toBe(true);
    q.queryFn();
    expect(commandesApi.remisesCommis).toHaveBeenCalledWith('c1');
    expect((useRemisesCommisDeCommande(undefined) as unknown as { enabled: boolean }).enabled).toBe(false);
    expect((useRemisesCommisDeCommande('c1', false) as unknown as { enabled: boolean }).enabled).toBe(false);
  });

  it('remises à confirmer : relues toutes les 30 s, sauf temps réel connecté', () => {
    const q = useRemisesCommisAConfirmer(true) as unknown as { queryKey: unknown; refetchInterval: unknown; enabled: boolean };
    expect(q.queryKey).toEqual([...commandeKeys.all, 'remises-a-confirmer']);
    expect(q.refetchInterval).toBe(30_000);
    expect(q.enabled).toBe(true);
    (useTempsReelConnecte as jest.Mock).mockReturnValueOnce(true);
    expect((useRemisesCommisAConfirmer(true) as unknown as { refetchInterval: unknown }).refetchInterval).toBe(false);
    expect((useRemisesCommisAConfirmer(false) as unknown as { enabled: boolean }).enabled).toBe(false);
  });

  it('confirmer : POST puis relecture des commandes (remises comprises) et du stock', async () => {
    const m = useConfirmerRemiseCommis() as unknown as { mutationFn: (id: string) => Promise<unknown>; onSuccess: () => void; onError: () => void };
    await m.mutationFn('r1');
    expect(commandesApi.confirmerRemise).toHaveBeenCalledWith('r1');
    m.onSuccess();
    expect(cles()).toEqual(expect.arrayContaining([commandeKeys.all, stockKeys.all]));
    invalidateQueries.mockClear();
    m.onError();
    expect(cles()).toEqual([commandeKeys.all]);
  });

  it('refuser : POST avec le motif puis relecture des commandes', async () => {
    const m = useRefuserRemiseCommis() as unknown as {
      mutationFn: (v: { id: string; motif: string }) => Promise<unknown>;
      onSuccess: () => void;
      onError: () => void;
    };
    await m.mutationFn({ id: 'r1', motif: 'Abîmé' });
    expect(commandesApi.refuserRemise).toHaveBeenCalledWith('r1', 'Abîmé');
    m.onSuccess();
    expect(cles()).toEqual([commandeKeys.all]);
  });
});
