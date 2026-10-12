import { apiClient } from '../../lib/api-client';
import { chargerDetailRecu } from './recuDonnees';
import type { ReversementRecord } from '../../types/api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const OCTOBRE = { debut: '2026-10-01', fin: '2026-10-31' };

const reversement = (partiel: Partial<ReversementRecord>): ReversementRecord => ({
  id: 'rev-1',
  type: 'CLIENT',
  beneficiaireId: 'c1',
  livreurId: 'liv-1',
  montant: 300,
  periodeMois: 10,
  periodeAnnee: 2026,
  dateReversement: '2026-10-08T00:00:00',
  commentaire: null,
  ...partiel,
});
const RACINE = { id: 'liv-1', parentId: null };
const APPRENTI = { id: 'app-1', parentId: 'liv-1' };

beforeEach(() => {
  jest.clearAllMocks();
  get.mockImplementation((url: string) =>
    Promise.resolve({ data: url === '/retour' ? { contenu: [], page: 0, taille: 200, total: 0 } : [] }),
  );
});

describe('chargerDetailRecu', () => {
  it('sans période : aucun détail, aucune lecture', async () => {
    await expect(chargerDetailRecu(reversement({ periodeMois: 0 as never }), RACINE)).resolves.toEqual({ type: 'aucun' });
    expect(get).not.toHaveBeenCalled();
  });

  it('client, livreur principal : livraisons de son équipe et retours du client, limités au mois', async () => {
    const d = await chargerDetailRecu(reversement({}), RACINE);
    expect(d.type).toBe('client');
    expect(get).toHaveBeenCalledWith('/livraison/parent/liv-1', { params: OCTOBRE });
    expect(get).toHaveBeenCalledWith('/retour', { params: { clientId: 'c1', ...OCTOBRE, page: 0, taille: 200 } });
  });

  it('client, apprenti : ses livraisons seulement', async () => {
    await chargerDetailRecu(reversement({}), APPRENTI);
    expect(get).toHaveBeenCalledWith('/livraison/livraison-livreur/app-1', { params: OCTOBRE });
  });

  it('retours sur plusieurs pages : toutes lues', async () => {
    const retour = (i: number) => ({ id: `r${i}`, client: { id: 'c1' }, produit: { id: 'p', designation: 'Pain' }, quantite: 1, dateRetour: '2026-10-02T08:00:00' });
    get.mockImplementation((url: string, { params }: { params: { page: number } }) =>
      Promise.resolve({
        data:
          url === '/retour'
            ? { contenu: params.page === 0 ? [retour(1), retour(2)] : params.page === 1 ? [retour(3)] : [], page: params.page, taille: 2, total: 3 }
            : [],
      }),
    );
    const d = await chargerDetailRecu(reversement({}), RACINE);
    expect(get.mock.calls.filter(([u]) => u === '/retour')).toHaveLength(2);
    expect(d.type === 'client' && d.totaux.qteRetournee).toBe(3);
  });

  it('livreur (remise fournisseur) : mes commandes chez ce fournisseur sur le mois ; apprenti : filtrées ensuite', async () => {
    const r = reversement({ type: 'FOURNISSEUR', beneficiaireId: 'f1' });
    await chargerDetailRecu(r, RACINE);
    expect(get).toHaveBeenLastCalledWith('/commande/me', { params: { fournisseurId: 'f1', ...OCTOBRE } });

    get.mockResolvedValue({
      data: [
        {
          id: 'k1', reference: 'CMD-1', date: '2026-10-02T08:00:00', livreur: { id: 'app-1' }, fournisseur: { id: 'f2' },
          receptions: [{ id: 'x', dateReception: '2026-10-03T08:00:00', annulee: false, lignes: [{ produit: { id: 'p', designation: 'Pain' }, quantite: 4, prixUnitaire: 50 }] }],
        },
      ],
    });
    const d = await chargerDetailRecu(r, APPRENTI);
    expect(get).toHaveBeenLastCalledWith('/commande/me', { params: OCTOBRE });
    // Commande chez un autre fournisseur : écartée.
    expect(d).toEqual({ type: 'livreur', commandes: [], totaux: { quantite: 0, montant: 0 } });
  });

  it('lecture en échec : l’erreur est propagée (l’appelant édite « Détail indisponible »)', async () => {
    get.mockRejectedValue(new Error('Network Error'));
    await expect(chargerDetailRecu(reversement({}), RACINE)).rejects.toThrow('Network Error');
  });
});
