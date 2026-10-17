import { apiClient } from '../../lib/api-client';
import { authApi } from '../auth/api';
import {
  commisApi,
  commisModificationSchema,
  commisSchema,
  nomCommis,
  payloadCommis,
  payloadModificationCommis,
} from './commis';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: {} });
  put.mockResolvedValue({ data: {} });
});

const valide = { prenom: 'Awa', nom: 'Koné', contact: '0701020304', username: 'Awa.Kone', password: 'secret1' };

describe('Commis du fournisseur : validation du formulaire (mêmes règles que le web)', () => {
  it('accepte un commis complet', () => {
    expect(commisSchema.safeParse(valide).success).toBe(true);
  });

  it('refuse un téléphone hors 01 / 05 / 07 ou de mauvaise longueur', () => {
    for (const contact of ['0612345678', '070102030', '07010203040', '', 'abcdefghij']) {
      const r = commisSchema.safeParse({ ...valide, contact });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.message).toBe('Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.');
    }
  });

  it('refuse un identifiant trop court, un mot de passe trop court, un nom vide', () => {
    expect(commisSchema.safeParse({ ...valide, username: 'ab' }).success).toBe(false);
    expect(commisSchema.safeParse({ ...valide, password: '12345' }).success).toBe(false);
    expect(commisSchema.safeParse({ ...valide, nom: ' ' }).success).toBe(false);
  });

  it('envoie l’identifiant en minuscules, sans espaces autour', () => {
    const parsed = commisSchema.parse({ ...valide, username: '  Awa.Kone ', contact: ' 0701020304 ' });
    expect(payloadCommis(parsed)).toEqual({
      prenom: 'Awa',
      nom: 'Koné',
      contact: '0701020304',
      username: 'awa.kone',
      password: 'secret1',
    });
  });

  it('modification : mêmes règles sans mot de passe, identifiant en minuscules', () => {
    const { password: _ignore, ...identite } = valide;
    expect(commisModificationSchema.safeParse({ ...identite, contact: '0612345678' }).success).toBe(false);
    expect(commisModificationSchema.safeParse({ ...identite, username: 'ab' }).success).toBe(false);
    const parsed = commisModificationSchema.parse({ ...identite, username: ' Awa.K ' });
    expect(payloadModificationCommis(parsed)).toEqual({ prenom: 'Awa', nom: 'Koné', contact: '0701020304', username: 'awa.k' });
  });

  it('nom complet', () => {
    expect(nomCommis({ prenom: 'Awa', nom: 'Koné' })).toBe('Awa Koné');
  });
});

describe('Commis du fournisseur : API (routes du back)', () => {
  it('liste, création, activation, réinitialisation, demandes', async () => {
    await commisApi.liste();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/commis');
    await commisApi.creer({ ...valide, username: 'awa.kone' });
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/commis', { ...valide, username: 'awa.kone' });
    const identite = { prenom: 'Awa', nom: 'Koné', contact: '0701020304', username: 'awa.k' };
    await commisApi.modifier('c1', identite);
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/commis/c1', identite);
    await commisApi.basculer('c1', false);
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/commis/c1/actif', { actif: false });
    post.mockResolvedValueOnce({ data: { tempPassword: 'Xy7kP2qa', message: 'ok' } });
    await expect(commisApi.reinitialiserMotDePasse('c1')).resolves.toEqual({ tempPassword: 'Xy7kP2qa', message: 'ok' });
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/commis/c1/reset-password');
    await expect(commisApi.demandesMotDePasse()).resolves.toEqual([]);
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/commis/demandes-mot-de-passe');
  });

  it('ignorer une demande réutilise la route existante', () => {
    expect(typeof authApi.ignorerDemandeReinitialisation).toBe('function');
  });
});
