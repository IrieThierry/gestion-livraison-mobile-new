import type {
  CommandeResponse,
  FournisseurAvecRelation,
  StatutCommande,
  UUID,
  VersementResponse,
} from '../../../types/api';
import { arrondi, dansPeriode, num, parDate, somme, type Periode } from './commun';

const LIBELLES_STATUT: Record<StatutCommande, string> = {
  ENVOYEE: 'Envoyée',
  CONFIRMEE: 'Confirmée',
  EN_RECEPTION: 'En réception',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
  LIVREE: 'Livrée',
};

export function libelleStatutCommande(statut: StatutCommande): string {
  return LIBELLES_STATUT[statut] ?? String(statut);
}

export interface LigneCommande {
  id: UUID;
  date: string;
  reference: string;
  fournisseur: string;
  statut: string;
  /** Σ des réceptions actives (0 tant qu'aucune réception). */
  montantRecu: number;
}

export interface LigneReception {
  date: string;
  reference: string;
  commande: string;
  fournisseur: string;
  /** Σ quantité × prix figé. */
  montant: number;
  /** Σ quantité × remise livreur figée. */
  remise: number;
}

export interface LigneVersement {
  id: UUID;
  date: string;
  fournisseur: string;
  montantVerse: number;
  detteApres: number;
}

export interface LigneFournisseur {
  fournisseurId: UUID;
  fournisseur: string;
  nbCommandes: number;
  /** Réceptions de la période. */
  montantRecu: number;
  remiseRecue: number;
  /** Versements de la période. */
  montantVerse: number;
  /** Dû actuel au fournisseur (négatif = avance), null si inconnu. */
  du: number | null;
  /** Remise que le fournisseur doit encore reverser, null si inconnue. */
  remiseARecevoir: number | null;
}

export interface EtatFournisseurs {
  parFournisseur: LigneFournisseur[];
  commandes: LigneCommande[];
  receptions: LigneReception[];
  versements: LigneVersement[];
  totaux: {
    nbCommandes: number;
    /** Σ du reçu des commandes de la période (toutes réceptions confondues). */
    montantCommandes: number;
    montantRecu: number;
    remiseRecue: number;
    montantVerse: number;
    du: number;
    remiseARecevoir: number;
  };
}

/**
 * État « Fournisseurs et versements » (livreur principal) :
 * - commandes passées dans la période (date de commande) ;
 * - réceptions actives de la période (date de réception), quelle que soit la
 *   date de la commande ;
 * - versements de la période ;
 * - par fournisseur, le dû et la remise à recevoir ACTUELS (`/livreur/me/fournisseurs`).
 */
export function calculerEtatFournisseurs(
  partenaires: readonly FournisseurAvecRelation[],
  commandes: readonly CommandeResponse[],
  versements: readonly VersementResponse[],
  periode: Periode,
): EtatFournisseurs {
  const lignesCommandes: LigneCommande[] = commandes
    .filter((c) => dansPeriode(c.date, periode))
    .sort(parDate((c) => c.date))
    .map((c) => ({
      id: c.id,
      date: c.date,
      reference: c.reference ?? '',
      fournisseur: c.fournisseur?.libelle ?? '',
      statut: libelleStatutCommande(c.statut),
      montantRecu: arrondi(num(c.montantLivre)),
    }));

  const receptions: (LigneReception & { fournisseurId: UUID })[] = [];
  for (const c of commandes) {
    for (const r of c.receptions ?? []) {
      if (r.annulee || !dansPeriode(r.dateReception, periode)) continue;
      receptions.push({
        fournisseurId: c.fournisseur?.id ?? '',
        date: r.dateReception,
        reference: r.reference ?? '',
        commande: c.reference ?? '',
        fournisseur: c.fournisseur?.libelle ?? '',
        montant: somme(r.lignes ?? [], (l) => num(l.quantite) * num(l.prixUnitaire)),
        remise: somme(r.lignes ?? [], (l) => num(l.quantite) * num(l.remiseLivreurUnitaire)),
      });
    }
  }
  receptions.sort(parDate((r) => r.date));

  const lignesVersements = versements
    .filter((v) => dansPeriode(v.dateVersement, periode))
    .sort(parDate((v) => v.dateVersement))
    .map((v) => ({
      id: v.id,
      fournisseurId: v.fournisseur?.id ?? '',
      date: v.dateVersement,
      fournisseur: v.fournisseur?.libelle ?? '',
      montantVerse: arrondi(num(v.montantVerse)),
      detteApres: arrondi(num(v.detteApres)),
    }));

  const parId = new Map<UUID, LigneFournisseur>();
  const ligneDe = (id: UUID, libelle: string): LigneFournisseur => {
    const existante = parId.get(id);
    if (existante) return existante;
    const nouvelle: LigneFournisseur = {
      fournisseurId: id,
      fournisseur: libelle,
      nbCommandes: 0,
      montantRecu: 0,
      remiseRecue: 0,
      montantVerse: 0,
      du: null,
      remiseARecevoir: null,
    };
    parId.set(id, nouvelle);
    return nouvelle;
  };

  for (const p of partenaires) {
    if (p.relation?.statut !== 'ACCEPTEE') continue;
    const l = ligneDe(p.id, p.libelle ?? '');
    l.du = p.du == null ? null : arrondi(num(p.du));
    l.remiseARecevoir = p.remiseARecevoir == null ? null : arrondi(num(p.remiseARecevoir));
  }
  for (const c of commandes) {
    if (!dansPeriode(c.date, periode)) continue;
    ligneDe(c.fournisseur?.id ?? '', c.fournisseur?.libelle ?? '').nbCommandes += 1;
  }
  for (const r of receptions) {
    const l = ligneDe(r.fournisseurId, r.fournisseur);
    l.montantRecu = arrondi(l.montantRecu + r.montant);
    l.remiseRecue = arrondi(l.remiseRecue + r.remise);
  }
  for (const v of lignesVersements) {
    const l = ligneDe(v.fournisseurId, v.fournisseur);
    l.montantVerse = arrondi(l.montantVerse + v.montantVerse);
  }

  const parFournisseur = [...parId.values()].sort((a, b) =>
    a.fournisseur.localeCompare(b.fournisseur, 'fr'),
  );

  return {
    parFournisseur,
    commandes: lignesCommandes,
    receptions: receptions.map(({ fournisseurId: _id, ...r }) => r),
    versements: lignesVersements.map(({ fournisseurId: _id, ...v }) => v),
    totaux: {
      nbCommandes: lignesCommandes.length,
      montantCommandes: somme(lignesCommandes, (c) => c.montantRecu),
      montantRecu: somme(parFournisseur, (f) => f.montantRecu),
      remiseRecue: somme(parFournisseur, (f) => f.remiseRecue),
      montantVerse: somme(parFournisseur, (f) => f.montantVerse),
      du: somme(parFournisseur, (f) => f.du ?? 0),
      remiseARecevoir: somme(parFournisseur, (f) => f.remiseARecevoir ?? 0),
    },
  };
}
