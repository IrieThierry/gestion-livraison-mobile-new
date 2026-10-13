import { filtrerRecherche } from '../../lib/recherche';
import { PERIODES_JOURS, dansBornes, type Bornes, type RaccourciJours } from '../../lib/periode';
import type { EncaissementLivraisonResponse } from '../../types/api';
import { num } from './regles';

/** Raccourcis de période de « Mes encaissements ». */
export type RaccourciEncaissements = RaccourciJours;

/**
 * Période de « Mes encaissements » (7 j par défaut, `PERIODE_ENCAISSEMENTS_DEFAUT`).
 * La route `GET /encaissement/livraison/livreur/{id}` ne prend pas de dates :
 * la période filtre la liste localement, sur la date d'encaissement.
 */
export const PERIODES_ENCAISSEMENTS = PERIODES_JOURS;

export const PERIODE_ENCAISSEMENTS_DEFAUT: RaccourciEncaissements = '7j';

/** Nom affiché du client d'un encaissement (« Prénom Nom »), vide si inconnu. */
export function nomClientEncaissement(e: EncaissementLivraisonResponse): string {
  return e.client ? `${e.client.prenom ?? ''} ${e.client.nom ?? ''}`.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Liste « Mes encaissements » : période (jours entiers, bornes incluses, sur
 * la date d'encaissement), recherche sur le client et les références
 * (encaissement et livraisons réglées), tri du plus récent au plus ancien,
 * total des encaissements affichés.
 */
export function listeEncaissements(
  encaissements: readonly EncaissementLivraisonResponse[],
  recherche: string,
  bornes: Bornes = {},
): { lignes: EncaissementLivraisonResponse[]; total: number } {
  const dansPeriode = encaissements.filter((e) => dansBornes(e.dateEncaissement, bornes));
  const lignes = filtrerRecherche(dansPeriode, recherche, (e) => [
    nomClientEncaissement(e),
    e.reference,
    ...(e.livraisons ?? []).map((l) => l.reference),
  ]).sort((a, b) => {
    const da = a.dateEncaissement ? new Date(a.dateEncaissement).getTime() : 0;
    const db = b.dateEncaissement ? new Date(b.dateEncaissement).getTime() : 0;
    return db - da;
  });
  const total = Math.round(lignes.reduce((acc, e) => acc + num(e.montantEncaisse), 0) * 100) / 100;
  return { lignes, total };
}
