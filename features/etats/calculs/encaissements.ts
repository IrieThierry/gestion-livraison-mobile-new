import type {
  EncaissementLivraisonResponse,
  EncoursClientResponse,
  UUID,
} from '../../../types/api';
import { arrondi, dansPeriode, nomPersonne, num, parDate, somme, type Periode } from './commun';

/** Un encaissement de la période. */
export interface LigneEncaissement {
  id: UUID;
  date: string;
  reference: string;
  client: string;
  livreur: string;
  montant: number;
  /** < 0 : reste dû ; > 0 : surplus vers l'avance (figé à l'enregistrement). */
  ecart: number;
}

/** Solde actuel d'un client (encours serveur, pas d'historique à une date passée). */
export interface LigneCreance {
  clientId: UUID;
  client: string;
  totalLivre: number;
  totalEncaisse: number;
  /** Solde actuel ; négatif = avance du client. */
  solde: number;
}

export interface EtatEncaissements {
  encaissements: LigneEncaissement[];
  creances: LigneCreance[];
  totaux: {
    nbEncaissements: number;
    montantEncaisse: number;
    ecart: number;
    /** Σ des soldes positifs (ce que les clients doivent). */
    totalDu: number;
    /** Σ des avances (soldes négatifs, en valeur absolue). */
    totalAvances: number;
    /** Solde net = dû − avances. */
    soldeNet: number;
  };
}

/**
 * État « Encaissements et créances ».
 * - Encaissements : le back renvoie tout l'historique, on garde ceux dont
 *   `dateEncaissement` tombe dans la période.
 * - Créances : solde ACTUEL de chaque client non soldé (« Solde actuel »),
 *   l'encours n'ayant pas d'historique à une date passée.
 */
export function calculerEtatEncaissements(
  encaissements: readonly EncaissementLivraisonResponse[],
  encours: readonly EncoursClientResponse[],
  periode: Periode,
): EtatEncaissements {
  const lignes: LigneEncaissement[] = encaissements
    .filter((e) => dansPeriode(e.dateEncaissement, periode))
    .sort(parDate((e) => e.dateEncaissement))
    .map((e) => ({
      id: e.id,
      date: e.dateEncaissement,
      reference: e.reference ?? '',
      client: nomPersonne(e.client),
      livreur: nomPersonne(e.livreur),
      montant: arrondi(num(e.montantEncaisse)),
      ecart: arrondi(num(e.ecart)),
    }));

  const creances: LigneCreance[] = encours
    .filter((c) => arrondi(num(c.solde)) !== 0)
    .map((c) => ({
      clientId: c.clientId,
      client: c.nomClient ?? '',
      totalLivre: arrondi(num(c.totalLivre)),
      totalEncaisse: arrondi(num(c.totalEncaisse)),
      solde: arrondi(num(c.solde)),
    }))
    .sort((a, b) => b.solde - a.solde || a.client.localeCompare(b.client, 'fr'));

  const totalDu = somme(
    creances.filter((c) => c.solde > 0),
    (c) => c.solde,
  );
  const totalAvances = somme(
    creances.filter((c) => c.solde < 0),
    (c) => -c.solde,
  );

  return {
    encaissements: lignes,
    creances,
    totaux: {
      nbEncaissements: lignes.length,
      montantEncaisse: somme(lignes, (e) => e.montant),
      ecart: somme(lignes, (e) => e.ecart),
      totalDu,
      totalAvances,
      soldeNet: arrondi(totalDu - totalAvances),
    },
  };
}
