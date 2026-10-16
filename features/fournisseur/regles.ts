import type {
  CommandeResponse,
  DemandeModificationVersementResponse,
  LivreurPartenaireDuResponse,
} from '../../types/api';

/**
 * F2 : règles pures de l'Accueil du fournisseur (synthèse du mois, chiffres
 * des commandes et des livreurs, « À traiter »). Mêmes données que la page
 * Synthèse du portail web.
 */

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const p2 = (n: number) => String(n).padStart(2, '0');

/** Mois `yyyy-MM` d'une date (heure locale). */
export function moisDe(d: Date = new Date()): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}`;
}

/** Mois voisin (`delta` = -1 : précédent, +1 : suivant). */
export function moisVoisin(mois: string, delta: number): string {
  const [a, m] = mois.split('-').map(Number);
  return moisDe(new Date(a, m - 1 + delta, 1));
}

/** « octobre 2026 » ; la valeur brute si elle est illisible. */
export function libelleMois(mois: string): string {
  const r = /^(\d{4})-(\d{2})$/.exec(mois);
  if (!r) return mois;
  const nom = MOIS[Number(r[2]) - 1];
  return nom ? `${nom} ${r[1]}` : mois;
}

/** Pas de mois futur : « mois suivant » seulement avant le mois en cours. */
export function peutAvancer(mois: string, now: Date = new Date()): boolean {
  return mois < moisDe(now);
}

/** Commande à confirmer par le fournisseur (envoyée par le livreur). */
export const estAConfirmer = (c: Pick<CommandeResponse, 'statut'>) => c.statut === 'ENVOYEE';

/** Date de livraison d'une commande livrée (réception, sinon « Passer à Livrée »). */
const dateLivree = (c: Pick<CommandeResponse, 'dateLivraison' | 'dateLivree'>) => c.dateLivraison ?? c.dateLivree ?? null;

export interface ResumeCommandes {
  /** Envoyées, à confirmer. */
  enAttente: number;
  /** Montant estimé des commandes en attente. */
  montantEnAttente: number;
  /** Confirmées ou en réception (à livrer). */
  aLivrer: number;
  /** Livrées dans le mois. */
  livrees: number;
  /** Montant livré dans le mois. */
  montantLivre: number;
}

/**
 * Chiffres des commandes pour l'Accueil : en attente et à livrer (toutes
 * dates), livrées et montant livré dans le mois `yyyy-MM`.
 */
export function resumeCommandes(commandes: readonly CommandeResponse[] | undefined, mois: string): ResumeCommandes {
  const r: ResumeCommandes = { enAttente: 0, montantEnAttente: 0, aLivrer: 0, livrees: 0, montantLivre: 0 };
  for (const c of commandes ?? []) {
    if (estAConfirmer(c)) {
      r.enAttente++;
      r.montantEnAttente += Number(c.montantEstime) || 0;
    } else if (c.statut === 'CONFIRMEE' || c.statut === 'EN_RECEPTION') {
      r.aLivrer++;
    } else if (c.statut === 'LIVREE' && (dateLivree(c) ?? '').startsWith(mois)) {
      r.livrees++;
      r.montantLivre += Number(c.montantLivre) || 0;
    }
  }
  return r;
}

export interface ResumeLivreurs {
  /** Livreurs partenaires (bloqués compris). */
  nombre: number;
  /** Ce que les livreurs te doivent (somme des dûs positifs ; les avances ne s'en déduisent pas). */
  du: number;
  /** Livreurs qui te doivent quelque chose. */
  debiteurs: number;
  /** Remises livrées pas encore reversées. */
  remiseAReverser: number;
}

export function resumeLivreurs(partenaires: readonly LivreurPartenaireDuResponse[] | undefined): ResumeLivreurs {
  const r: ResumeLivreurs = { nombre: 0, du: 0, debiteurs: 0, remiseAReverser: 0 };
  for (const p of partenaires ?? []) {
    r.nombre++;
    const du = Number(p.du) || 0;
    if (du > 0) {
      r.du += du;
      r.debiteurs++;
    }
    r.remiseAReverser += Math.max(0, Number(p.remiseAReverser) || 0);
  }
  return r;
}

/** Demande de modification que le fournisseur doit décider : en attente et initiée par le livreur (même règle que le web). */
export const estADeciderParFournisseur = (d: Pick<DemandeModificationVersementResponse, 'statut' | 'demandeurType'>) =>
  d.statut === 'PENDING' && d.demandeurType === 'LIVREUR';

export const nbDemandesADecider = (demandes: readonly DemandeModificationVersementResponse[] | undefined) =>
  (demandes ?? []).filter(estADeciderParFournisseur).length;

export type CodeTacheFournisseur = 'CMD' | 'INV' | 'VER';

export interface TacheFournisseur {
  code: CodeTacheFournisseur;
  nombre: number;
  titre: string;
  detail: string;
  /** Écran ouvert par la ligne (onglet de l'espace fournisseur). */
  lien: string;
}

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/**
 * « À traiter » : une ligne par rubrique non vide, dans l'ordre commandes à
 * confirmer, invitations de livreurs, demandes de modification de versement.
 */
export function tachesFournisseur({
  commandes,
  invitations,
  demandes,
}: {
  commandes: number;
  invitations: number;
  demandes: number;
}): TacheFournisseur[] {
  const taches: TacheFournisseur[] = [];
  if (commandes > 0) {
    taches.push({
      code: 'CMD',
      nombre: commandes,
      titre: pluriel(commandes, 'commande à confirmer', 'commandes à confirmer'),
      detail: 'Confirme ou refuse les commandes de tes livreurs.',
      lien: '/fournisseur/commandes',
    });
  }
  if (invitations > 0) {
    taches.push({
      code: 'INV',
      nombre: invitations,
      titre: pluriel(invitations, 'invitation de livreur', 'invitations de livreurs'),
      detail: 'Accepte ou refuse les livreurs qui veulent travailler avec toi.',
      lien: '/fournisseur/livreurs',
    });
  }
  if (demandes > 0) {
    taches.push({
      code: 'VER',
      nombre: demandes,
      titre: pluriel(demandes, 'demande de modification', 'demandes de modification'),
      detail: 'Versements : approuve ou rejette les demandes de tes livreurs.',
      lien: '/fournisseur/argent',
    });
  }
  return taches;
}
