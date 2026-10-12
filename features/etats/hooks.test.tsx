import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { etatsApi } from './api';
import { useEtatStock, useEtatVentes, type ParamsEtat } from './hooks';
import { ligneLivraison, livraison, mouvement } from './calculs/etats.fixture';

jest.mock('./api', () => ({
  etatsApi: {
    livraisons: jest.fn(),
    stockEquipe: jest.fn(),
    stockLivreur: jest.fn(),
    mouvements: jest.fn(),
  },
}));

const api = etatsApi as jest.Mocked<typeof etatsApi>;
const P = { debut: '2026-10-01', fin: '2026-10-31' };
const user = { id: 'p', prenom: 'Awa', nom: 'Kone', parentId: null };
const apprentis = [{ id: 'a1', prenom: 'Moussa', nom: 'Sy' }] as unknown as ParamsEtat['apprentis'];

const lecture = (etat: Partial<ParamsEtat['lectureApprentis']> = {}): ParamsEtat['lectureApprentis'] => ({
  isSuccess: true,
  isLoading: false,
  isError: false,
  error: null,
  isRefetching: false,
  refetch: jest.fn(),
  ...etat,
});
const APPRENTIS_LUS = lecture();

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

describe('hooks des états', () => {
  it('période invalide : aucune lecture, aucun document', () => {
    const { result } = renderHook(
      () => useEtatVentes({ user, choix: { type: 'moi' }, periode: null, libelleLivreur: 'Awa Kone', apprentis: [], lectureApprentis: APPRENTIS_LUS }),
      { wrapper },
    );
    expect(api.livraisons).not.toHaveBeenCalled();
    expect(result.current.document).toBeNull();
  });

  it('ventes : document construit sur la période, en-tête du livreur', async () => {
    api.livraisons.mockResolvedValue([]);
    const { result } = renderHook(
      () => useEtatVentes({ user, choix: { type: 'moi' }, periode: P, libelleLivreur: 'Awa Kone', apprentis: [], lectureApprentis: APPRENTIS_LUS }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(api.livraisons).toHaveBeenCalledWith({ mode: 'livreur', livreurId: 'p' }, P);
    expect(result.current.document?.livreur).toBe('Awa Kone');
    expect(result.current.document?.sections[0].lignes).toEqual([]);
  });

  it('stock en vue équipe : mouvements du principal et de chaque apprenti, livreur indiqué', async () => {
    api.stockEquipe.mockResolvedValue([]);
    api.mouvements.mockImplementation(async (id) =>
      id === 'a1'
        ? [mouvement('AJUSTEMENT', '2026-10-06T09:00:00', -2, 'Eau', 'Casse')]
        : [mouvement('RECEPTION', '2026-10-02T09:00:00', 10, 'Eau', 'REC-1')],
    );
    const { result } = renderHook(
      () =>
        useEtatStock({
          user,
          choix: { type: 'equipe' },
          periode: P,
          libelleLivreur: 'Équipe de Awa Kone',
          apprentis,
          lectureApprentis: APPRENTIS_LUS,
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(api.mouvements).toHaveBeenCalledWith('p', P);
    expect(api.mouvements).toHaveBeenCalledWith('a1', P);
    const detail = result.current.document!.sections.find((s) => s.titre === 'Détail des mouvements')!;
    expect(detail.colonnes.map((c) => c.libelle)).toContain('Livreur');
    expect(detail.lignes.map((l) => l[1])).toEqual(['Awa Kone', 'Moussa Sy']);
    expect(detail.lignes[1]).toContain('Ajustement');
  });
  const paramsEquipe = (lectureApprentis: ParamsEtat['lectureApprentis']): ParamsEtat => ({
    user,
    choix: { type: 'equipe' },
    periode: P,
    libelleLivreur: 'Équipe de Awa Kone',
    apprentis: [],
    lectureApprentis,
  });

  it('stock en vue équipe : apprentis en cours de lecture → chargement, aucune lecture, rien à partager', () => {
    const { result } = renderHook(() => useEtatStock(paramsEquipe(lecture({ isSuccess: false, isLoading: true }))), {
      wrapper,
    });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.document).toBeNull();
    expect(api.stockEquipe).not.toHaveBeenCalled();
    expect(api.mouvements).not.toHaveBeenCalled();
  });

  it('stock en vue équipe : lecture des apprentis en échec → erreur remontée, aucun document partiel', async () => {
    const erreur = new Error('Réseau indisponible');
    const refetch = jest.fn();
    api.stockEquipe.mockResolvedValue([]);
    api.mouvements.mockResolvedValue([]);
    const { result } = renderHook(
      () => useEtatStock(paramsEquipe(lecture({ isSuccess: false, isError: true, error: erreur, refetch }))),
      { wrapper },
    );
    expect(result.current.isError).toBe(true);
    expect(result.current.error).toBe(erreur);
    expect(result.current.document).toBeNull();
    expect(api.mouvements).not.toHaveBeenCalled();
    result.current.refetch();
    expect(refetch).toHaveBeenCalled();
  });

  it('stock en vue équipe : l’historique d’un membre en échec → erreur, pas de document', async () => {
    api.stockEquipe.mockResolvedValue([]);
    api.mouvements.mockImplementation(async (id) => {
      if (id === 'a1') throw new Error('500');
      return [];
    });
    const { result } = renderHook(
      () => useEtatStock({ ...paramsEquipe(APPRENTIS_LUS), apprentis }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.document).toBeNull();
  });

  it('vue « moi » : la lecture des apprentis ne bloque pas', async () => {
    api.stockLivreur.mockResolvedValue([]);
    api.mouvements.mockResolvedValue([]);
    const { result } = renderHook(
      () =>
        useEtatStock({
          ...paramsEquipe(lecture({ isSuccess: false, isError: true, error: new Error('x') })),
          choix: { type: 'moi' },
          libelleLivreur: 'Awa Kone',
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(result.current.isError).toBe(false);
    expect(api.mouvements).toHaveBeenCalledWith('p', P);
  });
  it('ventes filtrées : calcul limité au client, options tirées des données non filtrées', async () => {
    api.livraisons.mockResolvedValue([
      livraison({ id: '1', date: '2026-10-02T09:00:00', clientId: 'c1', client: 'Ali Traore', montantDu: 100, lignes: [ligneLivraison('p1', 'Eau', 1, 0, 100)] }),
      livraison({ id: '2', date: '2026-10-03T09:00:00', clientId: 'c2', client: 'Binta Diallo', montantDu: 200 }),
    ]);
    const { result } = renderHook(
      () =>
        useEtatVentes({
          user,
          choix: { type: 'moi' },
          periode: P,
          libelleLivreur: 'Awa Kone',
          apprentis: [],
          lectureApprentis: APPRENTIS_LUS,
          filtres: { client: { id: 'c2', label: 'Binta Diallo' }, produit: null, fournisseur: null, typeMouvement: null, categorie: null },
        }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.document).not.toBeNull());
    expect(result.current.document?.sections[0].lignes).toHaveLength(1);
    expect(result.current.document?.filtres).toEqual([{ libelle: 'Client', valeur: 'Binta Diallo' }]);
    expect(result.current.document?.nomFichier).toBe('Ventes_Binta-Diallo_2026-10-01_au_2026-10-31');
    expect(result.current.options.clients?.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(result.current.options.produits).toEqual([{ id: 'p1', label: 'Eau' }]);
  });
});
