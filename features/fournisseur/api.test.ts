import { apiClient } from '../../lib/api-client';
import { authApi } from '../auth/api';
import { fournisseurMeApi } from './api';

jest.mock('../../lib/api-client', () => ({
  apiClient: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() },
}));

const get = apiClient.get as jest.Mock;
const post = apiClient.post as jest.Mock;
const put = apiClient.put as jest.Mock;
const del = apiClient.delete as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  get.mockResolvedValue({ data: [] });
  post.mockResolvedValue({ data: { message: 'ok' } });
  put.mockResolvedValue({ data: {} });
  del.mockResolvedValue({ data: undefined });
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

describe('FM2 : commandes, livreurs partenaires, invitations (routes du portail web)', () => {
  it('confirmer et refuser une commande (motif seulement s’il existe)', async () => {
    await fournisseurMeApi.confirmerCommande('c1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/commandes/c1/confirmer');
    await fournisseurMeApi.refuserCommande('c1', 'rupture');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/commandes/c1/refuser', { motif: 'rupture' });
    await fournisseurMeApi.refuserCommande('c1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/commandes/c1/refuser', {});
  });

  it('lectures d’un livreur : commandes, prix particuliers triés par désignation', async () => {
    await fournisseurMeApi.commandesLivreur('l1');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/commandes');
    get.mockResolvedValueOnce({
      data: [
        { produitFournisseurId: 'p2', produit: { designation: 'Pain' } },
        { produitFournisseurId: 'p1', produit: { designation: 'Baguette' } },
      ],
    });
    const prix = await fournisseurMeApi.prixParticuliersLivreur('l1');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/prix-particuliers');
    expect(prix.map((p) => p.produitFournisseurId)).toEqual(['p1', 'p2']);
  });

  it('prix particulier, remise, blocage', async () => {
    await fournisseurMeApi.enregistrerPrixParticulier('pf1', 'l1', 120);
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/catalogue/pf1/prix-particuliers/l1', { prixOverride: 120 });
    await fournisseurMeApi.supprimerPrixParticulier('pf1', 'l1');
    expect(del).toHaveBeenLastCalledWith('/fournisseur/me/catalogue/pf1/prix-particuliers/l1');
    await fournisseurMeApi.enregistrerRemiseLivreur('l1', 25);
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/remise-livreur', { remiseLivreur: 25 });
    await fournisseurMeApi.supprimerRemiseLivreur('l1');
    expect(del).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/remise-livreur');
    await fournisseurMeApi.bloquerLivreur('l1', 'impayés');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/bloquer', { motif: 'impayés' });
    await fournisseurMeApi.bloquerLivreur('l1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/bloquer', {});
    await fournisseurMeApi.debloquerLivreur('l1');
    expect(del).toHaveBeenLastCalledWith('/fournisseur/me/livreurs/l1/bloquer');
  });

  it('versement reçu : situation (ids joints par des virgules) et enregistrement', async () => {
    await fournisseurMeApi.versementSituation('l1', ['c1', 'c2']);
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/versements/situation', {
      params: { livreurId: 'l1', commandeIds: 'c1,c2' },
    });
    await fournisseurMeApi.versementSituation('l1', []);
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/versements/situation', { params: { livreurId: 'l1' } });
    const payload = { livreurId: 'l1', commandeIds: ['c1'], dateVersement: '2026-10-16', montantVerse: 5000 };
    await fournisseurMeApi.enregistrerVersement(payload);
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/versements', payload);
  });

  it('invitations : accepter, refuser', async () => {
    await fournisseurMeApi.accepterInvitation('i1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/invitations/i1/accepter');
    await fournisseurMeApi.refuserInvitation('i1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/invitations/i1/refuser');
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
