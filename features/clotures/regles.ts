import type {
  ClotureJournaliereResponse,
  EncaissementLivraisonResponse,
  EnregistrerClotureRequest,
  LivraisonResponse,
  UUID,
} from '../../types/api';
import type { Resultat } from '../commandes/regles';
import { jourLocal, num } from '../encaissements/regles';
import { formatMontant } from '../../lib/format';

/**
 * Règles pures de la clôture de caisse.
 *
 * Le serveur calcule et fige les totaux de la clôture :
 *   - totalLivre    = Σ dû net des livraisons du jour (avant paiements) ;
 *   - totalEncaisse = Σ montantEncaisse des encaissements du jour ;
 *   - ecartEspeces  = totalEncaisse − montantRemis.
 * Écart positif = manque en caisse (le livreur a remis moins que l'encaissé) ;
 * écart négatif = excédent remis. Les totaux affichés avant l'envoi ne sont
 * qu'une **estimation** calculée sur le cache avec les mêmes définitions.
 */

/**
 * Les FCFA sont affichés SANS centimes (`formatFCFA`) : un écart de 0,40 s'affiche « 0 » et doit
 * donc être considéré comme équilibré, de façon cohérente avec l'affichage.
 */
export function estEquilibre(ecart: number): boolean {
  return Math.round(num(ecart)) === 0;
}

/**
 * Saisie du montant remis : obligatoire, ≥ 0 (0 = rien remis), virgule ou
 * point, 2 décimales maximum (le back attend un BigDecimal ≥ 0).
 */
export function parseMontantRemis(saisie: string): Resultat<number> {
  const s = saisie.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '') return { ok: false, erreur: 'Saisis le montant remis (0 si rien n’est remis).' };
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(s)) {
    return { ok: false, erreur: 'Montant invalide (nombre positif, 2 décimales maximum).' };
  }
  return { ok: true, valeur: Number(s) };
}

/** Écart (signe du back) : encaissé − remis, arrondi au centime. */
export function ecartCaisse(totalEncaisse: number, montantRemis: number): number {
  return Math.round((num(totalEncaisse) - num(montantRemis)) * 100) / 100;
}

export type SensEcart = 'equilibre' | 'manque' | 'excedent';

/** Positif = manque en caisse ; négatif = excédent remis ; ~0 = équilibré. */
export function sensEcart(ecart: number): SensEcart {
  if (estEquilibre(ecart)) return 'equilibre';
  return num(ecart) > 0 ? 'manque' : 'excedent';
}

/** Libellé d'un écart (valeur absolue affichée, le sens est dans le texte). */
export function libelleEcart(ecart: number): string {
  const sens = sensEcart(ecart);
  if (sens === 'equilibre') return 'Caisse équilibrée';
  const montant = formatMontant(Math.abs(num(ecart)));
  return sens === 'manque'
    ? `Manque en caisse : ${montant} FCFA`
    : `Excédent remis : ${montant} FCFA`;
}

/** Jour local (`YYYY-MM-DD`) d'une date ISO / LocalDateTime ; null si invalide. */
function jourDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : jourLocal(d);
}

/**
 * Estimation des totaux du jour à partir du cache, avec les définitions du
 * serveur : Σ `montantDu` (dû net avant paiements) des livraisons du jour et
 * Σ `montantEncaisse` des encaissements dont `dateEncaissement` est ce jour.
 */
export function totauxEstimesDuJour(
  jour: string,
  livraisons: readonly Pick<LivraisonResponse, 'date' | 'montantDu'>[],
  encaissements: readonly Pick<EncaissementLivraisonResponse, 'dateEncaissement' | 'montantEncaisse'>[],
): { totalDu: number; totalEncaisse: number } {
  const totalDu = livraisons
    .filter((l) => jourDe(l.date) === jour)
    .reduce((acc, l) => acc + num(l.montantDu), 0);
  const totalEncaisse = encaissements
    .filter((e) => jourDe(e.dateEncaissement) === jour)
    .reduce((acc, e) => acc + num(e.montantEncaisse), 0);
  return {
    totalDu: Math.round(totalDu * 100) / 100,
    totalEncaisse: Math.round(totalEncaisse * 100) / 100,
  };
}

/** Requête de clôture : jour envoyé en début de journée, commentaire nettoyé. */
export function construireCloture(params: {
  livreurId: UUID;
  dateCloture: string | null;
  montantRemis: string;
  commentaire: string;
}): Resultat<EnregistrerClotureRequest> {
  if (!params.dateCloture) return { ok: false, erreur: 'Date de clôture requise.' };
  const remis = parseMontantRemis(params.montantRemis);
  if (!remis.ok) return remis;
  const commentaire = params.commentaire.trim();
  return {
    ok: true,
    valeur: {
      livreurId: params.livreurId,
      dateCloture: `${params.dateCloture.slice(0, 10)}T00:00:00`,
      montantRemis: remis.valeur,
      ...(commentaire ? { commentaire } : {}),
    },
  };
}

/** Message de succès construit sur les valeurs **retournées** par le serveur. */
export function messageClotureEnregistree(c: ClotureJournaliereResponse): string {
  return [
    `Total livré (dû) : ${formatMontant(num(c.totalLivre))} FCFA`,
    `Total encaissé : ${formatMontant(num(c.totalEncaisse))} FCFA`,
    `Montant remis : ${formatMontant(num(c.montantRemis))} FCFA`,
    libelleEcart(num(c.ecartEspeces)),
  ].join('\n');
}
