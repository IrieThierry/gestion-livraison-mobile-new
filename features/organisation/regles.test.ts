import {
  estCommercial,
  estMembreOrganisation,
  estResponsable,
  erreurDemandeChargement,
  erreurPrixImposes,
  libelleStatutDemande,
  messageAucunPrix,
  payloadDemandeChargement,
  peutAnnulerDemande,
  vocabulaire,
} from './regles';
import type { LigneSaisie } from '../livraisons/regles';

const independant = { id: 'l1', parentId: null, organisationId: null, organisationRole: null };
const apprenti = { id: 'a1', parentId: 'l1', organisationId: null, organisationRole: null };
const responsable = { id: 'r1', parentId: null, organisationId: 'o1', organisationRole: 'RESPONSABLE' as const };
const commercial = { id: 'c1', parentId: 'r1', organisationId: 'o1', organisationRole: 'COMMERCIAL' as const };

describe('rôles dans une organisation', () => {
  it('membre : responsable ou commercial avec une organisation', () => {
    expect(estMembreOrganisation(responsable)).toBe(true);
    expect(estMembreOrganisation(commercial)).toBe(true);
    expect(estMembreOrganisation(independant)).toBe(false);
    expect(estMembreOrganisation(apprenti)).toBe(false);
    expect(estMembreOrganisation(null)).toBe(false);
    // Ancienne session persistée (champs absents) : hors organisation.
    const ancienne = { id: 'x', parentId: null, organisationRole: undefined };
    expect(estMembreOrganisation(ancienne)).toBe(false);
  });

  it('commercial et responsable', () => {
    expect(estCommercial(commercial)).toBe(true);
    expect(estCommercial(responsable)).toBe(false);
    expect(estCommercial(apprenti)).toBe(false);
    expect(estResponsable(responsable)).toBe(true);
    expect(estResponsable(commercial)).toBe(false);
    expect(estResponsable(independant)).toBe(false);
  });
});

describe('vocabulaire (O4)', () => {
  it('organisation : Commercial et Responsable, « Rendre au dépôt »', () => {
    const v = vocabulaire(commercial);
    expect(v.Apprenti).toBe('Commercial');
    expect(v.apprentis).toBe('commerciaux');
    expect(v.Principal).toBe('Responsable');
    expect(v.tonPrincipal).toBe('ton responsable');
    expect(v.tonPrincipalCourt).toBe('ton responsable');
    expect(v.rendreStock).toBe('Rendre au dépôt');
    expect(v.role).toBe('Commercial');
    expect(vocabulaire(responsable).role).toBe('Responsable');
    expect(vocabulaire(responsable).mesApprentis).toBe('Mes commerciaux');
  });

  it('hors organisation : vocabulaire inchangé', () => {
    const v = vocabulaire(apprenti);
    expect(v.Apprenti).toBe('Apprenti');
    expect(v.apprentis).toBe('apprentis');
    expect(v.tonPrincipal).toBe('ton livreur principal');
    expect(v.tonPrincipalCourt).toBe('ton principal');
    expect(v.rendreStock).toBe('Rendre du stock');
    expect(v.mesApprentis).toBe('Mes apprentis');
    expect(v.role).toBeNull();
  });
});

describe('prix imposés (O6)', () => {
  it('message de la spec, mot pour mot', () => {
    expect(messageAucunPrix('Coca 33cl')).toBe('Aucun prix fixé pour Coca 33cl : contactez votre responsable.');
  });

  it('une ligne sans prix fixé bloque la vente avec le message de la spec', () => {
    expect(
      erreurPrixImposes(<LigneSaisie[]>[
        { produitId: 'p1', designation: 'Coca 33cl', prix: 500, qte: 2 },
        { produitId: 'p2', designation: 'Fanta', prix: 0, qte: 1 },
      ]),
    ).toBe('Aucun prix fixé pour Fanta : contactez votre responsable.');
    expect(erreurPrixImposes(<LigneSaisie[]>[{ produitId: 'p1', designation: 'Coca 33cl', prix: 500, qte: 2 }])).toBeNull();
    // Ligne à 0 : non envoyée, donc pas bloquante.
    expect(erreurPrixImposes(<LigneSaisie[]>[{ produitId: 'p2', designation: 'Fanta', prix: 0, qte: 0 }])).toBeNull();
  });
});

describe('demande de chargement (O8)', () => {
  it('au moins un produit avec une quantité', () => {
    expect(erreurDemandeChargement([])).toBe('Une demande de chargement doit contenir au moins un produit.');
    expect(erreurDemandeChargement([{ produitId: 'p1', designation: 'Coca', qte: 0 }])).toBe(
      'Une demande de chargement doit contenir au moins un produit.',
    );
    expect(erreurDemandeChargement([{ produitId: 'p1', designation: 'Coca', qte: 3 }])).toBeNull();
  });

  it('payload : lignes à quantité > 0 seulement', () => {
    expect(
      payloadDemandeChargement([
        { produitId: 'p1', designation: 'Coca', qte: 10 },
        { produitId: 'p2', designation: 'Fanta', qte: 0 },
      ]),
    ).toEqual({ lignes: [{ produitId: 'p1', quantite: 10 }] });
  });

  it('statuts et annulation (en attente seulement)', () => {
    expect(libelleStatutDemande('EN_ATTENTE')).toBe('En attente');
    expect(libelleStatutDemande('SERVIE')).toBe('Servie');
    expect(libelleStatutDemande('REFUSEE')).toBe('Refusée');
    expect(libelleStatutDemande('ANNULEE')).toBe('Annulée');
    expect(peutAnnulerDemande({ statut: 'EN_ATTENTE' })).toBe(true);
    expect(peutAnnulerDemande({ statut: 'SERVIE' })).toBe(false);
    expect(peutAnnulerDemande({ statut: 'ANNULEE' })).toBe(false);
  });
});
