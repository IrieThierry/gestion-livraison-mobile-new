import type {
  CommandeResponse,
  ProduitCommandeResponse,
  ReceptionCommandeResponse,
} from '../../types/api';

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
      profile: 'LIVREUR',
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
    date: '2026-10-01T08:00:00',
    dateDecision: null,
    motifRefus: null,
    dateLivraison: null,
    montantLivre: null,
    remiseLivreurLivree: null,
    versementId: null,
    apprentiAffecte: null,
    affectePar: null,
    dateAffectation: null,
    receptions: [],
    livreeManuellement: false,
    livreePar: null,
    dateLivree: null,
    produitsCommandes: [
      {
        id: 'l1',
        produit: { id: 'p1', code: 'BAG', designation: 'Baguette' },
        qteCommandee: 10,
        qteRecue: 0,
        qteRestante: 10,
        montantRecu: 0,
        remiseLivreurRecue: 0,
      },
    ],
    ...overrides,
  };
}

/** Ligne de commande : `qteRestante` = commandée − reçue (surchargeable). */
export function ligneCommandeFixture(
  produitId: string,
  designation: string,
  qteCommandee: number,
  qteRecue = 0,
): ProduitCommandeResponse {
  return {
    id: `l-${produitId}`,
    produit: { id: produitId, code: produitId.toUpperCase(), designation },
    qteCommandee,
    qteRecue,
    qteRestante: Math.max(0, qteCommandee - qteRecue),
    montantRecu: 0,
    remiseLivreurRecue: 0,
  };
}

/** Réception active REC-1 reçue par le titulaire, surchargeable. */
export function receptionFixture(
  overrides: Partial<ReceptionCommandeResponse> = {},
): ReceptionCommandeResponse {
  return {
    id: 'r-1',
    reference: 'REC-1',
    dateReception: '2026-10-02T09:00:00',
    receptionnePar: { id: 'l-1', nom: 'Ahmed Koné' },
    modifieePar: null,
    dateModification: null,
    annulee: false,
    annuleePar: null,
    dateAnnulation: null,
    lignes: [],
    ...overrides,
  };
}
