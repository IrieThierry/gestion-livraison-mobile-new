import { buildCreerClientPayload, buildModifierClientPayload } from './regles';
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
  it('conserve le livreur du client et envoie ni prix par défaut ni limite de crédit', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte');
    expect(p).not.toHaveProperty('prixDeVenteProduitParDefault');
    expect(p).not.toHaveProperty('limiteCredit');
    expect(p.livreurId).toBe('l-proprio');
    expect(p.id).toBe('c-1');
    expect(p).not.toHaveProperty('margeParUnite');
  });

  it('apprenti (D20) : omet avecOuSansRemise, garde le reste', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte', false);
    expect(p).not.toHaveProperty('avecOuSansRemise');
    expect(p).not.toHaveProperty('prixDeVenteProduitParDefault');
    expect(p).not.toHaveProperty('limiteCredit');
    expect(p.nom).toBe(champs.nom);
  });

  it('racine/admin : envoie avecOuSansRemise', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte', true);
    expect(p.avecOuSansRemise).toBe(champs.avecOuSansRemise);
    expect(p).not.toHaveProperty('prixDeVenteProduitParDefault');
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

describe('buildCreerClientPayload', () => {
  const draft = {
    prenom: 'A',
    nom: 'B',
    contact: '07',
    email: '',
    adresse: '',
    latitudeLongitude: '1,2',
    quartierId: 'q',
    categorieId: 'k',
    avecRemise: true,
  };

  it("n'envoie ni prixDeVenteProduitParDefault ni limiteCredit", () => {
    const p = buildCreerClientPayload(draft, 'l-1', true);
    expect(p).not.toHaveProperty('prixDeVenteProduitParDefault');
    expect(p).not.toHaveProperty('limiteCredit');
    expect(p.livreurId).toBe('l-1');
  });

  it('racine : transmet le statut remise', () => {
    expect(buildCreerClientPayload(draft, 'l-1', true).avecOuSansRemise).toBe(true);
  });

  it('apprenti : ignore avecRemise du brouillon (hérité d’une session racine)', () => {
    expect(buildCreerClientPayload(draft, 'l-1', false).avecOuSansRemise).toBe(false);
  });
});
