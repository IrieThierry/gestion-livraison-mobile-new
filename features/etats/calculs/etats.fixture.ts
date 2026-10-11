import type {
  CommandeResponse,
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  FournisseurAvecRelation,
  LivraisonResponse,
  MouvementStockResponse,
  ProduitLivraisonResponse,
  VersementResponse,
} from '../../../types/api';

/** Jeux de données minimaux des états (seuls les champs utilisés sont renseignés). */

export const PERIODE_OCTOBRE = { debut: '2026-10-01', fin: '2026-10-31' };

export function ligneLivraison(
  produitId: string,
  designation: string,
  qteLivre: number,
  qteRetourne: number,
  prixDeVente: number,
  remiseUnitaire = 0,
): ProduitLivraisonResponse {
  return {
    id: `pl-${produitId}-${qteLivre}`,
    produit: { id: produitId, code: produitId, designation },
    qteLivre,
    qteRetourne,
    prixDeVente,
    remiseUnitaire,
    margeUnitaire: 0,
    qteRetourneeEnStock: 0,
  };
}

export function livraison(p: {
  id: string;
  date: string;
  clientId: string;
  client: string;
  montantDu: number;
  remiseNette?: number;
  lignes?: ProduitLivraisonResponse[];
  livreur?: string;
}): LivraisonResponse {
  const [prenom, nom] = p.client.split(' ');
  return {
    id: p.id,
    reference: `LIV-${p.id}`,
    client: { id: p.clientId, prenom, nom } as LivraisonResponse['client'],
    livreur: { id: 'liv-1', prenom: p.livreur ?? 'Awa', nom: 'Kone' } as LivraisonResponse['livreur'],
    date: p.date,
    produitsLivraison: p.lignes ?? [],
    statut: 'LIVREE',
    montantLivre: p.montantDu,
    montantDu: p.montantDu,
    remiseNette: p.remiseNette ?? 0,
    avecRemise: false,
    montantPaye: 0,
    resteDu: p.montantDu,
    entierementPayee: false,
    encaissementReferences: [],
  };
}

export function encaissement(p: {
  id: string;
  date: string;
  client: string;
  montant: number;
  ecart?: number;
}): EncaissementLivraisonResponse {
  const [prenom, nom] = p.client.split(' ');
  return {
    id: p.id,
    reference: `ENC-${p.id}`,
    livreur: { id: 'liv-1', prenom: 'Awa', nom: 'Kone' } as EncaissementLivraisonResponse['livreur'],
    client: { id: `c-${p.client}`, prenom, nom } as EncaissementLivraisonResponse['client'],
    dateEncaissement: p.date,
    montantEncaisse: p.montant,
    duChoisi: p.montant,
    ecart: p.ecart ?? 0,
    detteAvant: 0,
    detteApres: 0,
    commentaire: null,
    livraisons: [],
  };
}

export function encours(clientId: string, nomClient: string, solde: number): EncoursClientResponse {
  return {
    clientId,
    nomClient,
    totalLivre: Math.max(solde, 0) + 1000,
    totalRetour: 0,
    totalEncaisse: 1000,
    solde,
    totalRemise: 0,
  };
}

export function mouvement(
  type: MouvementStockResponse['type'],
  date: string,
  quantite: number,
  designation = 'Eau 1,5 L',
  reference: string | null = null,
  contrepartie: string | null = null,
): MouvementStockResponse {
  return {
    date,
    type,
    produit: { id: `p-${designation}`, code: 'P', designation },
    quantite,
    reference,
    contrepartie,
  };
}

export function partenaire(
  id: string,
  libelle: string,
  du: number | null,
  remiseARecevoir: number | null,
  statut: 'ACCEPTEE' | 'EN_ATTENTE' = 'ACCEPTEE',
): FournisseurAvecRelation {
  return {
    id,
    code: id,
    libelle,
    interlocuteur: '',
    contact: '',
    relation: { id: `r-${id}`, statut, dateInvitation: '2026-01-01', dateDecision: null },
    bloque: false,
    du,
    remiseARecevoir,
  };
}

export function commande(p: {
  id: string;
  date: string;
  fournisseurId: string;
  fournisseur: string;
  montantLivre?: number | null;
  receptions?: Array<{ date: string; annulee?: boolean; lignes: Array<[number, number, number]> }>;
}): CommandeResponse {
  return {
    id: p.id,
    reference: `CMD-${p.id}`,
    fournisseur: { id: p.fournisseurId, libelle: p.fournisseur } as CommandeResponse['fournisseur'],
    statut: 'LIVREE',
    date: p.date,
    montantLivre: p.montantLivre ?? null,
    receptions: (p.receptions ?? []).map((r, i) => ({
      id: `${p.id}-r${i}`,
      reference: `REC-${p.id}-${i}`,
      dateReception: r.date,
      annulee: !!r.annulee,
      lignes: r.lignes.map(([quantite, prixUnitaire, remiseLivreurUnitaire]) => ({
        produit: { id: 'p', code: 'p', designation: 'P' },
        quantite,
        prixUnitaire,
        remiseLivreurUnitaire,
      })),
    })),
  } as unknown as CommandeResponse;
}

export function versement(p: {
  id: string;
  date: string;
  fournisseurId: string;
  fournisseur: string;
  montant: number;
  detteApres?: number;
}): VersementResponse {
  return {
    id: p.id,
    fournisseur: { id: p.fournisseurId, libelle: p.fournisseur } as VersementResponse['fournisseur'],
    dateVersement: p.date,
    montantVerse: p.montant,
    detteApres: p.detteApres ?? 0,
  } as unknown as VersementResponse;
}
