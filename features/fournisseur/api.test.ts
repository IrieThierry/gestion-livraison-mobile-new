import { apiClient } from '../../lib/api-client';
import { authApi } from '../auth/api';
import { fournisseurMeApi } from './api';

jest.mock('../../lib/api-client', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: { message: 'ok' } });
});

describe('F3 : API du fournisseur connecté (mêmes routes que le portail web)', () => {
  it('profil, synthèse et reversements du mois', async () => {
    await fournisseurMeApi.profil();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me');
    await fournisseurMeApi.synthese('2026-10');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/synthese', { params: { mois: '2026-10' } });
    await fournisseurMeApi.reversementsSynthese('2026-10');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/reversements-synthese', { params: { mois: '2026-10' } });
  });

  it('commandes, livreurs partenaires, invitations', async () => {
    await fournisseurMeApi.commandes();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/commandes');
    await fournisseurMeApi.livreursPartenaires();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/livreurs-partenaires');
    await fournisseurMeApi.invitations();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/invitations');
    get.mockResolvedValueOnce({ data: { enAttente: 3 } });
    await expect(fournisseurMeApi.compteInvitations()).resolves.toBe(3);
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/invitations/compte');
  });

  it('demandes de modification de versement, filtrées par statut', async () => {
    await fournisseurMeApi.demandesModif('PENDING');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/demandes-modif-versement', { params: { statut: 'PENDING' } });
    await fournisseurMeApi.demandesModif();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/demandes-modif-versement', { params: undefined });
  });
});

describe('F1 : inscription (POST /auth/register)', () => {
  const base = {
    prenom: 'Awa',
    nom: 'Kone',
    contact: '0712345678',
    email: '',
    username: 'awa',
    password: 'secret1',
    confirmPassword: 'secret1',
  };

  it('fournisseur : profil et nom de l’entreprise, sans la confirmation', async () => {
    await authApi.register({ ...base, profile: 'FOURNISSEUR', nomEntreprise: ' Boulangerie 2000 ' });
    expect(post).toHaveBeenCalledWith('/auth/register', {
      prenom: 'Awa',
      nom: 'Kone',
      contact: '0712345678',
      email: '',
      username: 'awa',
      password: 'secret1',
      profile: 'FOURNISSEUR',
      nomEntreprise: 'Boulangerie 2000',
    });
  });

  it('livreur : jamais de nom d’entreprise envoyé', async () => {
    await authApi.register({ ...base, profile: 'LIVREUR', nomEntreprise: 'Ignorée' });
    const body = post.mock.calls[0][1];
    expect(body.profile).toBe('LIVREUR');
    expect(body).not.toHaveProperty('nomEntreprise');
    expect(body).not.toHaveProperty('confirmPassword');
  });
});
