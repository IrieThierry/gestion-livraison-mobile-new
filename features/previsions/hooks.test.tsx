import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  ErreurEnregistrementPartiel,
  useEnregistrerPrevisions,
  useMemoirePlusTard,
  useModifierGroupe,
  usePlusTard,
  usePrevisionsEchues,
  useReporterGroupes,
  viderMemoireSessionPlusTard,
} from './hooks';
import { previsionsApi } from './api';
import { livraisonsApi } from '../livraisons/api';
import { cleGroupe, cleStockagePlusTard, jourLocal, regrouperPrevisions } from './regles';
import type { PrevisionResponse } from '../../types/api';

jest.mock('./api', () => ({
  previsionsApi: { byLivreur: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() },
}));
jest.mock('../livraisons/api', () => ({ livraisonsApi: { byLivreur: jest.fn(), byParent: jest.fn() } }));

const api = previsionsApi as unknown as Record<'byLivreur' | 'create' | 'update' | 'remove', jest.Mock>;
const livByLivreur = livraisonsApi.byLivreur as jest.Mock;

const client = { id: 'c1', prenom: 'Awa', nom: 'T' };
const PAIN = { id: 'p1', code: 'p1', designation: 'Pain' };
const CROISSANT = { id: 'p2', code: 'p2', designation: 'Croissant' };
const prev = (id: string, jour: string, qte: number, o: Partial<PrevisionResponse> = {}): PrevisionResponse =>
  ({
    id,
    livreur: { id: 'L1', prenom: 'Ali', nom: 'K' },
    client,
    produit: PAIN,
    qteEstimee: qte,
    dateLivraison: `${jour}T00:00:00`,
    commentaire: null,
    ...o,
  }) as unknown as PrevisionResponse;

let journal: string[] = [];
// Clients vidés après chaque test (aucun minuteur de ramasse-miettes ne retient Jest).
const clients: QueryClient[] = [];
afterEach(() => {
  for (const c of clients.splice(0)) c.clear();
});
function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: 0, gcTime: Infinity } } });
  clients.push(qc);
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  return { qc, Wrapper };
}

beforeEach(() => {
  jest.clearAllMocks();
  journal = [];
  viderMemoireSessionPlusTard();
  api.create.mockImplementation(async (p: { produitId: string; qteEstimee: number; dateLivraison: string; commentaire?: string }) => {
    journal.push(`POST ${p.produitId} ${p.dateLivraison} ${p.qteEstimee}${p.commentaire ? ` « ${p.commentaire} »` : ''}`);
    return prev(`new-${p.produitId}`, p.dateLivraison, p.qteEstimee, {
      produit: p.produitId === 'p1' ? PAIN : CROISSANT,
      commentaire: p.commentaire ?? null,
    });
  });
  api.update.mockImplementation(async (id: string, p: { qteEstimee: number; commentaire?: string }) => {
    journal.push(`PUT ${id} ${p.qteEstimee}${p.commentaire ? ` « ${p.commentaire} »` : ''}`);
    return undefined;
  });
  api.remove.mockImplementation(async (id: string) => {
    journal.push(`DELETE ${id}`);
  });
});

describe('useEnregistrerPrevisions', () => {
  it('relit le jour, complète l’existante (PUT + commentaire ajouté) et crée les autres', async () => {
    api.byLivreur.mockResolvedValue([prev('x', '2026-10-13', 4, { commentaire: 'matin' })]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useEnregistrerPrevisions(), { wrapper: Wrapper });
    await act(() =>
      result.current.mutateAsync({
        livreurId: 'L1',
        clientId: 'c1',
        jour: '2026-10-13',
        commentaire: 'urgent',
        lignes: [
          { produitId: 'p1', qte: 3 },
          { produitId: 'p2', qte: 2 },
        ],
      }),
    );
    expect(api.byLivreur).toHaveBeenCalledTimes(1);
    expect(api.byLivreur).toHaveBeenCalledWith('L1', '2026-10-13');
    expect(journal).toEqual(['PUT x 7 « matin · urgent »', 'POST p2 2026-10-13 2 « urgent »']);
  });

  it('échec au milieu : erreur partielle, les lignes écrites sont signalées une à une', async () => {
    api.byLivreur.mockResolvedValue([]);
    api.create.mockResolvedValueOnce(prev('a', '2026-10-13', 3)).mockRejectedValueOnce(new Error('réseau'));
    const ecrites: string[] = [];
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useEnregistrerPrevisions(), { wrapper: Wrapper });
    let erreur: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync({
          livreurId: 'L1',
          clientId: 'c1',
          jour: '2026-10-13',
          lignes: [
            { produitId: 'p1', qte: 3 },
            { produitId: 'p2', qte: 2 },
            { produitId: 'p3', qte: 1 },
          ],
          onLigneEcrite: (id) => ecrites.push(id),
        });
      } catch (e) {
        erreur = e;
      }
    });
    expect(erreur).toBeInstanceOf(ErreurEnregistrementPartiel);
    expect((erreur as ErreurEnregistrementPartiel).ecrites).toEqual(['p1']);
    expect((erreur as ErreurEnregistrementPartiel).enEchec).toBe('p2');
    expect(ecrites).toEqual(['p1']);
    expect(api.create).toHaveBeenCalledTimes(2);
  });
});

describe('useModifierGroupe', () => {
  it('PUT de la première (commentaire du groupe gardé) puis DELETE des autres', async () => {
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useModifierGroupe(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ groupe: { ids: ['a', 'b', 'c'], commentaire: 'note' }, qte: 9 }));
    expect(journal).toEqual(['PUT a 9 « note »', 'DELETE b', 'DELETE c']);
  });
});

describe('useReporterGroupes', () => {
  const groupe = (ids: string[], jour: string, qte: number, livre = 0) =>
    regrouperPrevisions(
      ids.map((id) => prev(id, jour, qte / ids.length)),
      livre
        ? ([
            {
              livreur: { id: 'L1' },
              client,
              date: `${jour}T09:00:00`,
              produitsLivraison: [{ produit: PAIN, qteLivre: livre }],
            },
          ] as never)
        : [],
    )[0];

  it('crée au jour cible (marqué « Reporté du ») puis supprime ; un 2e groupe vers la même cible complète', async () => {
    api.byLivreur.mockResolvedValue([]);
    const g1 = groupe(['a', 'b'], '2026-10-10', 6, 2); // reste 4
    const g2 = groupe(['c'], '2026-10-11', 3); // reste 3
    const g3 = groupe(['d'], '2026-10-09', 2, 2); // reste 0 : ignoré
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useReporterGroupes(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ groupes: [g1, g2, g3], jourCible: '2026-10-13' }));
    expect(api.byLivreur).toHaveBeenCalledTimes(1);
    expect(journal).toEqual([
      'POST p1 2026-10-13 4 « Reporté du 10/10 »',
      'DELETE a',
      'DELETE b',
      'PUT new-p1 7 « Reporté du 10/10 · Reporté du 11/10 »',
      'DELETE c',
    ]);
  });

  it('nouvel essai après un échec de suppression : pas de nouvel ajout, seulement la suppression', async () => {
    api.byLivreur.mockResolvedValue([prev('t', '2026-10-13', 4, { commentaire: 'Reporté du 10/10' })]);
    const g = groupe(['a'], '2026-10-10', 4);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useReporterGroupes(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ groupes: [g], jourCible: '2026-10-13' }));
    expect(journal).toEqual(['DELETE a']);
  });
});

describe('« Plus tard »', () => {
  const aujourdhui = jourLocal();

  it('mémoire par utilisateur dans AsyncStorage, choix des jours passés purgés', async () => {
    await AsyncStorage.setItem(cleStockagePlusTard('u1'), JSON.stringify({ vieux: '2000-01-01' }));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => ({ ecrire: usePlusTard('u1'), lire: useMemoirePlusTard('u1') }), {
      wrapper: Wrapper,
    });
    await act(() => result.current.ecrire.mutateAsync(['k1']));
    expect(JSON.parse((await AsyncStorage.getItem(cleStockagePlusTard('u1')))!)).toEqual({ k1: aujourdhui });
    await waitFor(() => expect(result.current.lire.data).toEqual({ k1: aujourdhui }));
    expect(await AsyncStorage.getItem(cleStockagePlusTard('u2'))).toBeNull();
  });

  it('stockage en panne : le choix reste en mémoire pour la session', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('plein'));
    const { Wrapper, qc } = wrapper();
    const { result } = renderHook(() => usePlusTard('u3'), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync(['k3']));
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('illisible'));
    qc.clear();
    const relu = renderHook(() => useMemoirePlusTard('u3'), { wrapper: Wrapper });
    await waitFor(() => expect(relu.result.current.data).toEqual({ k3: aujourdhui }));
  });
});

describe('usePrevisionsEchues', () => {
  const aujourdhui = jourLocal();
  const hier = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return jourLocal(d);
  })();

  it('lit J−1…J−7 du livreur connecté et ses livraisons ; filtre « Plus tard »', async () => {
    api.byLivreur.mockImplementation(async (_id: string, jour: string) => {
      if (jour === hier) return [prev('a', hier, 5), prev('b', hier, 2, { produit: CROISSANT })];
      return [];
    });
    livByLivreur.mockResolvedValue([]);
    await AsyncStorage.setItem(
      cleStockagePlusTard('L1'),
      JSON.stringify({ [cleGroupe('L1', 'c1', 'p2', hier)]: aujourdhui }),
    );
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => usePrevisionsEchues('L1', aujourdhui), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.byLivreur).toHaveBeenCalledTimes(7);
    expect(api.byLivreur.mock.calls.every((c) => c[0] === 'L1')).toBe(true);
    expect(livByLivreur).toHaveBeenCalledWith('L1', expect.objectContaining({ fin: hier }));
    await waitFor(() => expect(result.current.echues.map((g) => g.ids)).toEqual([['a']]));
    expect(result.current.isError).toBe(false);
    expect(result.current.partiel).toBe(false);
  });

  it('un jour en erreur : les autres restent affichés, signalés partiels', async () => {
    api.byLivreur.mockImplementation(async (_id: string, jour: string) => {
      if (jour === hier) return [prev('a', hier, 5)];
      if (jour < hier) throw new Error('500');
      return [];
    });
    livByLivreur.mockResolvedValue([]);
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => usePrevisionsEchues('L1', aujourdhui), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.partiel).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.echues).toHaveLength(1);
  });
});
