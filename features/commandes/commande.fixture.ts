import type { CommandeResponse } from '../../types/api';

/** Fabrique de test : commande ENVOYEE d'une seule ligne, surchargeable. */
export function commandeFixture(overrides: Partial<CommandeResponse> = {}): CommandeResponse {
  return {
    id: 'c-1',
    reference: 'CMDE-1',
    livreur: {
      id: 'l-1',
      nom: 'Koné',
      prenom: 'Ahmed',
      contact: '0712345678',
      email: '',
      username: 'ahmed',
      role: 'LIVREUR',
      parent: null,
    },
    fournisseur: {
      id: 'f-1',
      code: 'F-001',
      libelle: 'Boulangerie Soleil',
      interlocuteur: 'M. Koné',
      contact: '0701010101',
    },
    statut: 'ENVOYEE',
    date: '2026-10-01T08:00:00.000+00:00',
    dateDecision: null,
    motifRefus: null,
    dateLivraison: null,
    montantLivre: null,
    margeLivree: null,
    versementId: null,
    produitsCommandes: [
      {
        id: 'l1',
        produit: { id: 'p1', code: 'BAG', designation: 'Baguette', prixAchatParDefaut: 500 },
        qteCommandee: 10,
        qteLivree: null,
        prixUnitaire: null,
        margeUnitaire: null,
      },
    ],
    ...overrides,
  };
}
