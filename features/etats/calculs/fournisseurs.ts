import type {
  CommandeResponse,
  FournisseurAvecRelation,
  StatutCommande,
  UUID,
  VersementResponse,
} from '../../../types/api';
import {
  arrondi,
  dansPeriode,
  num,
  parDate,
  retenu,
  somme,
  type FiltresEtat,
  type Periode,
} from './commun';

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
  /** Σ de toutes les réceptions actives de la commande, y compris hors période (« Reçu (total commande) »). */
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

/**
 * Ligne « Par produit » (même règle que le web) :
 * - quantité commandée : Σ `qteCommandee` des commandes de la période (date de
 *   commande), hors commandes refusées ou annulées ;
 * - quantité reçue et montant : Σ des lignes des réceptions actives de la
 *   période (date de réception, quelle que soit la date de la commande),
 *   montant = quantité × prix figé à la réception. Le prix de la commande
 *   n'est pas exposé par ligne : le montant est donc celui du reçu, et son
 *   total égale « Reçu sur la période ».
 */
export interface LigneFournisseurProduit {
  produitId: UUID;
  designation: string;
  qteCommandee: number;
  qteRecue: number;
  montant: number;
}

/** Statuts dont les quantités ne sont pas comptées comme commandées (commande abandonnée). */
const STATUTS_NON_COMMANDES: readonly StatutCommande[] = ['REFUSEE', 'ANNULEE'];

export interface EtatFournisseurs {
  parFournisseur: LigneFournisseur[];
  parProduit: LigneFournisseurProduit[];
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
    qteCommandee: number;
    qteRecue: number;
    /** Σ des montants par produit (= montantRecu). */
    montantProduits: number;
  };
}

/**
 * État « Fournisseurs et versements » (livreur principal) :
 * - commandes passées dans la période (date de commande) ;
 * - réceptions actives de la période (date de réception), quelle que soit la
 *   date de la commande ;
 * - versements de la période ;
 * - par fournisseur, le dû et la remise à recevoir ACTUELS (`/livreur/me/fournisseurs`).
 * Filtre `fournisseurId` : tout l'état est limité à ce fournisseur.
 */
export function calculerEtatFournisseurs(
  tousPartenaires: readonly FournisseurAvecRelation[],
  toutesCommandes: readonly CommandeResponse[],
  tousVersements: readonly VersementResponse[],
  periode: Periode,
  filtres: FiltresEtat = {},
): EtatFournisseurs {
  const f = filtres.fournisseurId;
  const partenaires = tousPartenaires.filter((p) => retenu(f, p.id));
  const commandes = toutesCommandes.filter((c) => retenu(f, c.fournisseur?.id));
  const versements = tousVersements.filter((v) => retenu(f, v.fournisseur?.id));

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

  const produits = new Map<UUID, LigneFournisseurProduit>();
  const produitDe = (
    p: { id?: UUID; designation?: string | null } | null | undefined,
  ): LigneFournisseurProduit => {
    const id = p?.id ?? '';
    const existant = produits.get(id);
    if (existant) return existant;
    const nouveau: LigneFournisseurProduit = {
      produitId: id,
      designation: p?.designation ?? '—',
      qteCommandee: 0,
      qteRecue: 0,
      montant: 0,
    };
    produits.set(id, nouveau);
    return nouveau;
  };
  for (const c of commandes) {
    if (!dansPeriode(c.date, periode) || STATUTS_NON_COMMANDES.includes(c.statut)) continue;
    for (const pc of c.produitsCommandes ?? []) produitDe(pc.produit).qteCommandee += num(pc.qteCommandee);
  }

  const receptions: (LigneReception & { fournisseurId: UUID })[] = [];
  for (const c of commandes) {
    for (const r of c.receptions ?? []) {
      if (r.annulee || !dansPeriode(r.dateReception, periode)) continue;
      for (const l of r.lignes ?? []) {
        const p = produitDe(l.produit);
        p.qteRecue += num(l.quantite);
        p.montant = arrondi(p.montant + num(l.quantite) * num(l.prixUnitaire));
      }
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

  const parProduit = [...produits.values()].sort((a, b) =>
    a.designation.localeCompare(b.designation, 'fr'),
  );

  return {
    parFournisseur,
    parProduit,
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
      qteCommandee: parProduit.reduce((a, p) => a + p.qteCommandee, 0),
      qteRecue: parProduit.reduce((a, p) => a + p.qteRecue, 0),
      montantProduits: somme(parProduit, (p) => p.montant),
    },
  };
}
