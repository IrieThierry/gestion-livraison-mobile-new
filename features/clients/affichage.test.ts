import {
  champsRechercheClient,
  indiceClient,
  libelleSoldeClient,
  nomClient,
  optionsClients,
  soldesParClient,
} from './affichage';
import { filtrerRecherche } from '../../lib/recherche';
import type { EncoursClientResponse } from '../../types/api';

const client = (id: string, prenom: string, nom: string, quartier: string | null, contact: string) => ({
  id,
  prenom,
  nom,
  contact,
  quartier: quartier === null ? null : { libelle: quartier },
});

const enc = (clientId: string, solde: number) =>
  ({ clientId, solde }) as unknown as EncoursClientResponse;

describe('affichage client', () => {
  it('nomClient', () => {
    expect(nomClient({ prenom: 'Awa', nom: 'Koné' })).toBe('Awa Koné');
    expect(nomClient({ prenom: '', nom: 'Koné' })).toBe('Koné');
  });

  it('libelleSoldeClient : dû, avance, rien si nul ou inconnu', () => {
    expect(libelleSoldeClient(1500)).toMatch(/^Dû 1\s?500 FCFA$/);
    expect(libelleSoldeClient(-200)).toBe('Avance 200 FCFA');
    expect(libelleSoldeClient(0)).toBeNull();
    expect(libelleSoldeClient(undefined)).toBeNull();
    expect(libelleSoldeClient(null)).toBeNull();
  });

  it('indiceClient : quartier · contact · solde, parties vides omises', () => {
    const c = client('1', 'Awa', 'Koné', 'Cocody', '0707');
    expect(indiceClient(c, 300)).toBe('Cocody · 0707 · Dû 300 FCFA');
    expect(indiceClient(c, -50)).toBe('Cocody · 0707 · Avance 50 FCFA');
    expect(indiceClient(c, 0)).toBe('Cocody · 0707');
    expect(indiceClient(client('2', 'B', 'C', null, ''))).toBe('');
  });

  it('soldesParClient', () => {
    const m = soldesParClient([enc('1', 300), enc('2', -10)]);
    expect(m.get('1')).toBe(300);
    expect(m.get('2')).toBe(-10);
    expect(soldesParClient(undefined).size).toBe(0);
  });

  it('optionsClients : ordre conservé, hint absent si vide', () => {
    const clients = [client('1', 'Awa', 'Koné', 'Cocody', '0707'), client('2', 'Bob', 'Zadi', null, '')];
    const opts = optionsClients(clients, soldesParClient([enc('1', 100)]));
    expect(opts.map((o) => o.id)).toEqual(['1', '2']);
    expect(opts[0]).toMatchObject({ label: 'Awa Koné', hint: 'Cocody · 0707 · Dû 100 FCFA' });
    expect(opts[1].hint).toBeUndefined();
  });

  it('recherche sur nom, prénom, quartier, contact', () => {
    const clients = [client('1', 'Awa', 'Koné', 'Cocody', '0707'), client('2', 'Bob', 'Zadi', 'Yopougon', '0505')];
    const f = (q: string) => filtrerRecherche(clients, q, champsRechercheClient).map((c) => c.id);
    expect(f('kone')).toEqual(['1']);
    expect(f('bob')).toEqual(['2']);
    expect(f('yopougon')).toEqual(['2']);
    expect(f('0505')).toEqual(['2']);
    expect(f('abobo')).toEqual([]);
  });
});
