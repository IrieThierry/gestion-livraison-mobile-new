import { lireDate } from '../notifications/regles';
import type {
  CatalogueCommisResponse,
  LigneQuantiteRequest,
  StatutCommandeCommis,
  StatutRemiseCommis,
  UUID,
} from '../../types/api';

/**
 * Règles pures de l'espace commis : lecture des quantités saisies (remise,
 * sortie), résumé de confirmation, libellés. Aucun prix ni montant.
 */

/** Quantité saisie : vide ou 0 → 0 (ligne ignorée), entier positif lu, sinon null (invalide). */
export function lireQuantite(saisie: string): number | null {
  const t = saisie.trim();
  if (t === '') return 0;
  return /^\d+$/.test(t) ? Number(t) : null;
}

export interface LignesSaisies {
  /** Lignes à envoyer (quantité > 0), dans l'ordre d'affichage. */
  lignes: LigneQuantiteRequest[];
  /** Produits dont la saisie n'est pas un nombre entier. */
  invalides: UUID[];
}

/** Lignes d'une saisie (quantités 0 ou vides ignorées) dans l'ordre des produits affichés. */
export function lignesSaisies(quantites: Readonly<Record<UUID, string>>, ordre: readonly UUID[]): LignesSaisies {
  const lignes: LigneQuantiteRequest[] = [];
  const invalides: UUID[] = [];
  for (const id of ordre) {
    const q = lireQuantite(quantites[id] ?? '');
    if (q === null) invalides.push(id);
    else if (q > 0) lignes.push({ produitFournisseurId: id, quantite: q });
  }
  return { lignes, invalides };
}

/** Envoi possible : au moins une quantité > 0 et aucune saisie invalide. */
export const saisieEnvoyable = (s: LignesSaisies): boolean => s.lignes.length > 0 && s.invalides.length === 0;

/** Résumé de confirmation : « 6 × Riz 25 kg », une ligne par produit. */
export function resumeLignes(lignes: readonly LigneQuantiteRequest[], designations: ReadonlyMap<UUID, string>): string {
  return lignes.map((l) => `${l.quantite} × ${designations.get(l.produitFournisseurId) ?? 'Produit'}`).join('\n');
}

/** Produits du catalogue qui ne sont pas encore dans la saisie. */
export function produitsAAjouter(
  catalogue: readonly CatalogueCommisResponse[],
  presents: readonly UUID[],
): CatalogueCommisResponse[] {
  const deja = new Set(presents);
  return catalogue.filter((p) => !deja.has(p.produitFournisseurId));
}

const LIBELLES_REMISE: Record<StatutRemiseCommis, string> = {
  EN_ATTENTE: 'En attente de confirmation',
  CONFIRMEE: 'Confirmée',
  REFUSEE: 'Refusée',
  ANNULEE: 'Annulée',
};

export const libelleStatutRemise = (s: StatutRemiseCommis): string => LIBELLES_REMISE[s] ?? s;

const LIBELLES_COMMANDE: Record<StatutCommandeCommis, string> = {
  CONFIRMEE: 'Confirmée',
  EN_RECEPTION: 'En réception',
  LIVREE: 'Livrée',
};

export const libelleStatutCommande = (s: StatutCommandeCommis): string => LIBELLES_COMMANDE[s] ?? s;

/** Une remise ne s'annule que tant qu'elle attend la confirmation du livreur. */
export const remiseAnnulable = (r: { statut: StatutRemiseCommis }): boolean => r.statut === 'EN_ATTENTE';

export const nomPersonne = (p: { prenom?: string | null; nom?: string | null }): string =>
  `${p.prenom ?? ''} ${p.nom ?? ''}`.trim();

const p2 = (n: number) => String(n).padStart(2, '0');

/** `jj/mm/aaaa hh:mm` d'une date du back (heure locale, sans fuseau) ; vide si illisible. */
export function dateHeure(valeur: string | null | undefined): string {
  const d = lireDate(valeur);
  return d ? `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()} ${heureDe(d)}` : '';
}

/** `hh:mm` d'une date du back ; vide si illisible. */
export function heure(valeur: string | null | undefined): string {
  const d = lireDate(valeur);
  return d ? heureDe(d) : '';
}

const heureDe = (d: Date) => `${p2(d.getHours())}:${p2(d.getMinutes())}`;
