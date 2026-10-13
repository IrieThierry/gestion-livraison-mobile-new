import { act, renderHook, waitFor } from '@testing-library/react-native';
import { dialog } from '../../lib/dialog';
import { organisationApi } from './api';
import { partagerAvoir, partagerFacture } from './partageDocument';
import { MESSAGE_FACTURE_INTROUVABLE, usePartageDocuments } from './usePartageDocuments';
import { avoir, facture } from './documents.fixture';

jest.mock('./api', () => ({ organisationApi: { factureDeLivraison: jest.fn(), avoir: jest.fn() } }));
jest.mock('./partageDocument', () => ({ partagerFacture: jest.fn(), partagerAvoir: jest.fn() }));
jest.mock('../../lib/dialog', () => ({ dialog: { error: jest.fn() } }));

const factureDeLivraison = organisationApi.factureDeLivraison as jest.Mock;
const lireAvoir = organisationApi.avoir as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (partagerFacture as jest.Mock).mockResolvedValue('file:///f.pdf');
  (partagerAvoir as jest.Mock).mockResolvedValue('file:///a.pdf');
});

describe('usePartageDocuments', () => {
  it('facture d’une vente : relue par livraisonId puis partagée ; double appui ignoré', async () => {
    let resoudre: (v: unknown) => void = () => {};
    factureDeLivraison.mockReturnValue(new Promise((r) => (resoudre = r)));
    const { result } = renderHook(() => usePartageDocuments());
    act(() => {
      result.current.factureDeLivraison('l1');
      result.current.factureDeLivraison('l1');
    });
    expect(result.current.enCours).toBe('l1');
    await act(async () => resoudre(facture));
    await waitFor(() => expect(result.current.enCours).toBeNull());
    expect(factureDeLivraison).toHaveBeenCalledTimes(1);
    expect(factureDeLivraison).toHaveBeenCalledWith('l1');
    expect(partagerFacture).toHaveBeenCalledWith(facture);
  });

  it('vente sans facture : message, aucun partage', async () => {
    factureDeLivraison.mockResolvedValue(null);
    const { result } = renderHook(() => usePartageDocuments());
    await act(async () => {
      result.current.factureDeLivraison('l2');
    });
    await waitFor(() => expect(dialog.error).toHaveBeenCalledWith('Partage impossible', MESSAGE_FACTURE_INTROUVABLE));
    expect(partagerFacture).not.toHaveBeenCalled();
  });

  it('avoir : GET /avoir/{id} puis partage ; refus du back affiché', async () => {
    lireAvoir.mockResolvedValueOnce(avoir);
    const { result } = renderHook(() => usePartageDocuments());
    await act(async () => {
      result.current.avoir('a1');
    });
    await waitFor(() => expect(partagerAvoir).toHaveBeenCalledWith(avoir));

    lireAvoir.mockRejectedValueOnce({ response: { status: 403, data: { message: 'Accès refusé : ressource inaccessible' } } });
    await act(async () => {
      result.current.avoir('a9');
    });
    await waitFor(() =>
      expect(dialog.error).toHaveBeenCalledWith('Partage impossible', 'Accès refusé : ressource inaccessible'),
    );
  });
});
