import { buildModifierClientPayload, parseLimiteCredit } from './regles';
import type { ClientResponse } from '../../types/api';

const champs = {
  prenom: 'A',
  nom: 'B',
  contact: '07',
  email: '',
  adresse: '',
  latitudeLongitude: '1,2',
  quartierId: 'q',
  categorieId: 'k',
  avecOuSansRemise: true,
};

const client = {
  id: 'c-1',
  livreur: { id: 'l-proprio' },
  prixDeVenteProduitParDefault: 450,
  limiteCredit: 50000,
} as unknown as ClientResponse;

describe('buildModifierClientPayload', () => {
  it('conserve prix par défaut, limite de crédit et livreur du client', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte');
    expect(p.prixDeVenteProduitParDefault).toBe(450);
    expect(p.limiteCredit).toBe(50000);
    expect(p.livreurId).toBe('l-proprio');
    expect(p.id).toBe('c-1');
    expect(p).not.toHaveProperty('margeParUnite');
  });

  it('omet limiteCredit quand le client n’en a pas (le back garde la valeur)', () => {
    const p = buildModifierClientPayload(
      { ...client, limiteCredit: null } as ClientResponse,
      champs,
      'l-connecte',
    );
    expect(p).not.toHaveProperty('limiteCredit');
  });

  it('retombe sur le livreur connecté seulement si le client n’a pas de livreur', () => {
    const p = buildModifierClientPayload(
      { ...client, livreur: undefined } as ClientResponse,
      champs,
      'l-connecte',
    );
    expect(p.livreurId).toBe('l-connecte');
  });
});

describe('parseLimiteCredit', () => {
  it('vide = 0, entier accepté, reste refusé', () => {
    expect(parseLimiteCredit('')).toBe(0);
    expect(parseLimiteCredit('50 000')).toBe(50000);
    expect(parseLimiteCredit('1,5')).toBeNull();
    expect(parseLimiteCredit('-3')).toBeNull();
  });
});
