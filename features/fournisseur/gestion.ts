import type { CommandeResponse, InvitationResponse, LivreurPartenaireDuResponse, UUID } from '../../types/api';
import type { FiltreStatutCommande } from '../commandes/regles';
import { estReglable } from '../commandes/regles';
import { validerVersement } from '../versements/regles';
import { filtrerRecherche } from '../../lib/recherche';
import { dansBornes, derniersJours, moisEnCours, type Bornes, type OptionPeriode } from '../../lib/periode';

/**
 * FM2 : règles des onglets Commandes et Livreurs du fournisseur, mêmes règles
 * que le portail web (`FournisseurCommandesPage`, `FournisseurLivreursPartenairesPage`,
 * dialogues Remise, Prix particuliers, Bloquer, Enregistrer un versement).
 */

// ─── Commandes reçues ─────────────────────────────────────────────────────

/** Filtres de statut du portail fournisseur (« À traiter » = envoyées, en attente de réponse). */
export const FILTRES_COMMANDES_FOURNISSEUR: ReadonlyArray<{ valeur: FiltreStatutCommande; label: string }> = [
  { valeur: 'TOUTES', label: 'Toutes' },
  { valeur: 'ENVOYEE', label: 'À traiter' },
  { valeur: 'CONFIRMEE', label: 'Confirmées' },
  { valeur: 'EN_RECEPTION', label: 'En réception' },
  { valeur: 'LIVREE', label: 'Livrées' },
  { valeur: 'REFUSEE', label: 'Refusées' },
  { valeur: 'ANNULEE', label: 'Annulées' },
];

export type RaccourciCommandes = 'tout' | 'mois' | '30j';

/** Période de la liste (date de la commande) : tout par défaut, comme le web, ou un intervalle. */
export const PERIODES_COMMANDES: ReadonlyArray<OptionPeriode<RaccourciCommandes>> = [
  { cle: 'tout', label: 'Tout', bornes: () => ({}) },
  { cle: 'mois', label: 'Ce mois', bornes: (n) => moisEnCours(n) },
  { cle: '30j', label: '30 j', bornes: (n) => derniersJours(30, n) },
];

/** Le fournisseur confirme une commande envoyée. */
export const peutConfirmer = (c: Pick<CommandeResponse, 'statut'>) => c.statut === 'ENVOYEE';

/** Il la refuse tant qu'aucune réception n'a commencé (envoyée ou confirmée). */
export const peutRefuser = (c: Pick<CommandeResponse, 'statut'>) =>
  c.statut === 'ENVOYEE' || c.statut === 'CONFIRMEE';

/** Prénom absent : seules les parties présentes sont jointes. */
export function nomLivreur(l: { nom: string; prenom?: string | null }): string {
  return [l.prenom, l.nom].filter(Boolean).join(' ');
}

/** Liste affichée : plus récentes d'abord, puis statut, période (date de commande) et recherche. */
export function filtrerCommandes(
  commandes: readonly CommandeResponse[] | undefined,
  { statut, bornes, recherche }: { statut: FiltreStatutCommande; bornes: Bornes; recherche: string },
): CommandeResponse[] {
  const triees = [...(commandes ?? [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const visibles = triees.filter((c) => (statut === 'TOUTES' || c.statut === statut) && dansBornes(c.date, bornes));
  return filtrerRecherche(visibles, recherche, (c) => [c.reference, nomLivreur(c.livreur)]);
}

export const MESSAGE_MOTIF_REFUS = 'Indique le motif du refus.';

/** Motif du refus (F2 : obligatoire sur le mobile) : le texte nettoyé, ou le message d'erreur. */
export function lireMotifRefus(saisie: string): { ok: true; motif: string } | { ok: false; erreur: string } {
  const motif = saisie.trim();
  return motif ? { ok: true, motif } : { ok: false, erreur: MESSAGE_MOTIF_REFUS };
}

// ─── Livreurs partenaires ─────────────────────────────────────────────────

/** Partenaires triés par nom (bloqués compris), filtrés par la recherche (nom, contact). */
export function filtrerPartenaires(
  partenaires: readonly LivreurPartenaireDuResponse[] | undefined,
  recherche: string,
): LivreurPartenaireDuResponse[] {
  const tries = [...(partenaires ?? [])].sort((a, b) =>
    nomLivreur(a.livreur).localeCompare(nomLivreur(b.livreur), 'fr'),
  );
  return filtrerRecherche(tries, recherche, (p) => [nomLivreur(p.livreur), p.livreur.contact]);
}

/** Libellé du dû : un dû négatif est une avance (montant versé en trop). */
export function libelleDu(du: number): { libelle: 'Dû' | 'Avance'; montant: number } {
  return du < 0 ? { libelle: 'Avance', montant: -du } : { libelle: 'Dû', montant: du };
}

export const nomInvitation = (i: InvitationResponse) => nomLivreur(i.livreur);

// ─── Saisie des montants (règles du catalogue du web, miroir du back) ─────

export type LectureMontant = { ok: true; valeur: number } | { ok: false; erreur: string };

const FORMAT_MONTANT = /^\d+([.,]\d{1,2})?$/;
const PLAFOND_CHIFFRES_ENTIERS = 12;
const SAISIE_INVALIDE = 'saisis un nombre (chiffres, virgule ou point, 2 décimales au plus).';

/**
 * Contrôle d'une saisie non vide : chiffres, au plus 2 décimales après « . » ou « , »,
 * au plus 12 chiffres avant la virgule ; un signe moins donne le message `negatif`.
 */
function lireMontant(saisie: string, libelle: string, negatif: string): LectureMontant {
  const s = saisie.trim();
  if (FORMAT_MONTANT.test(s)) {
    const entiers = (s.split(/[.,]/)[0] ?? '').replace(/^0+(?=\d)/, '');
    if (entiers.length > PLAFOND_CHIFFRES_ENTIERS) return { ok: false, erreur: `${libelle} : montant trop élevé.` };
    return { ok: true, valeur: Number(s.replace(',', '.')) };
  }
  if (/^\d+[.,]\d{3,}$/.test(s)) return { ok: false, erreur: `${libelle} : 2 décimales au plus.` };
  if (/^-\d+([.,]\d+)?$/.test(s)) return { ok: false, erreur: negatif };
  return { ok: false, erreur: `${libelle} : ${SAISIE_INVALIDE}` };
}

/** Remise livreur par unité (≥ 0, 2 décimales) ; vide = 0, comme le back. */
export function lireRemiseLivreur(saisie: string): LectureMontant {
  if (saisie.trim() === '') return { ok: true, valeur: 0 };
  return lireMontant(saisie, 'La remise livreur', 'La remise livreur ne peut pas être négative.');
}

/** FM3 : prix de vente d'une ligne du catalogue (obligatoire, > 0, 2 décimales), comme le web. */
export function lirePrixDeVente(saisie: string): LectureMontant {
  const negatif = 'Le prix de vente doit être supérieur à 0.';
  if (saisie.trim() === '') return { ok: false, erreur: negatif };
  const lecture = lireMontant(saisie, 'Le prix de vente', negatif);
  if (lecture.ok && lecture.valeur <= 0) return { ok: false, erreur: negatif };
  return lecture;
}

export const MESSAGE_PRIX_PARTICULIER_VIDE = 'Renseigne un prix particulier.';

/** Prix particulier : obligatoire et strictement positif (2 décimales). */
export function lirePrixParticulier(saisie: string): LectureMontant {
  if (saisie.trim() === '') return { ok: false, erreur: MESSAGE_PRIX_PARTICULIER_VIDE };
  const negatif = 'Le prix particulier doit être supérieur à 0.';
  const lecture = lireMontant(saisie, 'Le prix particulier', negatif);
  if (lecture.ok && lecture.valeur <= 0) return { ok: false, erreur: negatif };
  return lecture;
}

// ─── Versement reçu ───────────────────────────────────────────────────────

/** Commandes livrées de ce livreur, pas encore réglées (à cocher dans le versement). */
export function commandesAReglerDe(commandes: readonly CommandeResponse[] | undefined, livreurId: UUID) {
  return (commandes ?? []).filter((c) => estReglable(c) && c.livreur.id === livreurId);
}

/**
 * Message d'erreur du versement, ou null : montant obligatoire, ≥ 0 ; sans commande cochée
 * (versement libre), montant > 0. Le fournisseur est celui du jeton : seul le livreur compte.
 */
export function validerVersementRecu(p: { montant: string; nbCommandes: number }): string | null {
  return validerVersement({ fournisseurId: 'moi', montant: p.montant, nbCommandes: p.nbCommandes });
}
