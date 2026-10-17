import { apiClient } from '../../lib/api-client';
import {
  clientsApi,
  couleurDu,
  erreurClient,
  libelleModeVersement,
  lireMontantVersementClient,
  lirePrixClient,
  MODES_VERSEMENT_CLIENT,
  prixAffiche,
} from './clients';

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
  post.mockResolvedValue({ data: {} });
  put.mockResolvedValue({ data: {} });
  del.mockResolvedValue({ data: {} });
});

describe('Clients du fournisseur : API (routes du back)', () => {
  it('clients, création, modification', async () => {
    await clientsApi.liste();
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/clients');
    await clientsApi.creer({ nom: 'Boutique Awa', contact: '' });
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/clients', { nom: 'Boutique Awa', contact: '' });
    await clientsApi.modifier('k1', { nom: 'Boutique Awa', contact: '0701020304', actif: false });
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1', {
      nom: 'Boutique Awa',
      contact: '0701020304',
      actif: false,
    });
  });

  it('prix du client : lecture, prix propre, retrait', async () => {
    await clientsApi.prix('k1');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1/prix');
    await clientsApi.fixerPrix('k1', 'pf1', 275.5);
    expect(put).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1/prix/pf1', { prix: 275.5 });
    await clientsApi.retirerPrix('k1', 'pf1');
    expect(del).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1/prix/pf1');
  });

  it('situation, versement et annulation d’une sortie', async () => {
    await clientsApi.situation('k1');
    expect(get).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1/situation');
    const payload = { montant: 5000, date: '2026-10-17', mode: 'MOBILE_MONEY' as const, commentaire: 'solde' };
    await clientsApi.enregistrerVersement('k1', payload);
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/clients/k1/versements', payload);
    await clientsApi.annulerSortie('s1');
    expect(post).toHaveBeenLastCalledWith('/fournisseur/me/sorties/s1/annuler');
  });
});

describe('Clients du fournisseur : règles', () => {
  it('prix client affiché : le prix propre, sinon le prix du catalogue', () => {
    const base = { produitFournisseurId: 'pf1', designation: 'Baguette', photoUrl: null, prixCatalogue: 300 };
    expect(prixAffiche({ ...base, prixClient: 250 })).toEqual({ prix: 250, propre: true });
    expect(prixAffiche({ ...base, prixClient: null })).toEqual({ prix: 300, propre: false });
  });

  it('prix : strictement positif, 2 décimales, virgule acceptée', () => {
    expect(lirePrixClient('250,5')).toEqual({ ok: true, valeur: 250.5 });
    for (const s of ['', '0', '-3', 'abc', '1,234']) {
      expect(lirePrixClient(s)).toEqual({ ok: false, erreur: 'Le prix doit être supérieur à 0.' });
    }
  });

  it('versement : montant strictement positif', () => {
    expect(lireMontantVersementClient('5000')).toEqual({ ok: true, valeur: 5000 });
    for (const s of ['', '0', '0,00', '-5']) {
      expect(lireMontantVersementClient(s)).toEqual({ ok: false, erreur: 'Le montant doit être supérieur à 0.' });
    }
  });

  it('modes de paiement et libellés', () => {
    expect(MODES_VERSEMENT_CLIENT.map((m) => m.label)).toEqual(['Espèces', 'Mobile Money', 'Virement', 'Autre']);
    expect(libelleModeVersement('MOBILE_MONEY')).toBe('Mobile Money');
  });

  it('client : nom obligatoire, téléphone facultatif mais valide', () => {
    expect(erreurClient('Boutique', '')).toBeNull();
    expect(erreurClient('Boutique', '0701020304')).toBeNull();
    expect(erreurClient(' ', '')?.nom).toBe('Le nom du client est obligatoire.');
    expect(erreurClient('x'.repeat(101), '')?.nom).toBe('Le nom du client ne doit pas dépasser 100 caractères.');
    expect(erreurClient('Boutique', '0612')?.contact).toBe('Le numéro doit contenir 10 chiffres et commencer par 01, 05 ou 07.');
  });

  it('dû rouge quand il est positif', () => {
    expect(couleurDu(12500)).toBe('rouge');
    expect(couleurDu(0)).toBe('neutre');
    expect(couleurDu(-10)).toBe('neutre');
  });
});
