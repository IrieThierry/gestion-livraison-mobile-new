import type { AvoirResponse, FactureResponse } from '../../types/api';

/** Facture et avoir d'exemple (forme de FactureResponse / AvoirResponse du back, OB5). */
const organisation = {
  id: 'o1',
  raisonSociale: 'Distri CI',
  ncc: 'CI-NCC-1',
  rccm: 'CI-ABJ-2026-B-1',
  adresse: 'Plateau, Abidjan',
  telephone: '0707070707',
  email: 'jean@distri.ci',
  logoUrl: '/uploads/organisation/o1_logo.png',
};
const client = { id: 'c1', nom: 'Boutique Awa', prenom: 'Awa', contact: '0712345678', adresse: 'Rue 12', quartier: 'Yopougon' };
const commercial = { id: 'k1', nom: 'Kone', prenom: 'Ali', contact: '0505050505' };

export const facture: FactureResponse = {
  id: 'f1',
  numero: 'FAC-2026-000001',
  date: '2026-10-13T10:15:00',
  livraisonId: 'l1',
  livraisonReference: 'LIV-12',
  organisation,
  client,
  commercial,
  lignes: [
    { produitId: 'p1', code: 'PROD-12', designation: 'Coca <33cl>', quantite: 3, prixUnitaireTtc: 500, montantTtc: 1500 },
  ],
  totalTtc: 1500,
  payeALaVente: 0,
  resteDuALaVente: 1500,
  mentionPrix: 'Prix TTC',
  avoirs: [{ id: 'a1', numero: 'AV-2026-000001', date: '2026-10-13T11:02:00', totalTtc: 500 }],
  totalAvoirs: 500,
  montantPaye: 600,
  resteDu: 400,
};

export const avoir: AvoirResponse = {
  id: 'a1',
  numero: 'AV-2026-000001',
  date: '2026-10-13T11:02:00',
  motif: 'Retour produit',
  factureId: 'f1',
  factureNumero: 'FAC-2026-000001',
  livraisonId: 'l1',
  organisation,
  client,
  commercial,
  lignes: [{ produitId: 'p1', code: 'PROD-12', designation: 'Coca 33cl', quantite: 1, prixUnitaireTtc: 500, montantTtc: 500 }],
  totalTtc: 500,
  mentionPrix: 'Prix TTC',
};
