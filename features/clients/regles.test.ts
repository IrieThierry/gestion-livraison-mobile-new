import { buildCreerClientPayload, buildModifierClientPayload, validerRemiseClient } from './regles';
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
  remiseUnitaire: 25.5,
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

  it('apprenti (D21) : omet remiseUnitaire', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte', false);
    expect(p).not.toHaveProperty('remiseUnitaire');
  });

  it('racine/admin (D21) : envoie remiseUnitaire avec remise', () => {
    const p = buildModifierClientPayload(client, champs, 'l-connecte', true);
    expect(p.remiseUnitaire).toBe(25.5);
  });

  it('racine/admin sans remise : pas de remiseUnitaire (valeur stockée conservée)', () => {
    const p = buildModifierClientPayload(client, { ...champs, avecOuSansRemise: false }, 'l-connecte', true);
    expect(p).not.toHaveProperty('remiseUnitaire');
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
    remiseUnitaire: 25.5,
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

  it('racine (D21) : envoie remiseUnitaire', () => {
    expect(buildCreerClientPayload(draft, 'l-1', true).remiseUnitaire).toBe(25.5);
  });

  it('apprenti (D21) : n’envoie pas remiseUnitaire', () => {
    expect(buildCreerClientPayload(draft, 'l-1', false)).not.toHaveProperty('remiseUnitaire');
  });
});

describe('validerRemiseClient (D21)', () => {
  it.each([
    ['', 0],
    ['0', 0],
    ['12,5', 12.5],
    ['12.75', 12.75],
    ['999999999999.99', 999999999999.99],
  ])('accepte %p', (brut, attendu) => {
    expect(validerRemiseClient(brut)).toEqual({ ok: true, valeur: attendu });
  });

  it.each(['-1', '1.234', 'abc', '1000000000000'])('refuse %p avec le message du back', (brut) => {
    expect(validerRemiseClient(brut)).toEqual({
      ok: false,
      erreur: 'La remise doit être positive ou nulle, avec 2 décimales au plus.',
    });
  });
});
