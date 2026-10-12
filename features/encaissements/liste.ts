import { filtrerRecherche } from '../../lib/recherche';
import type { EncaissementLivraisonResponse } from '../../types/api';
import { num } from './regles';

/** Nom affiché du client d'un encaissement (« Prénom Nom »), vide si inconnu. */
export function nomClientEncaissement(e: EncaissementLivraisonResponse): string {
  return e.client ? `${e.client.prenom ?? ''} ${e.client.nom ?? ''}`.replace(/\s+/g, ' ').trim() : '';
}

/**
 * Liste « Mes encaissements » : recherche sur le client et les références
 * (encaissement et livraisons réglées), tri du plus récent au plus ancien,
 * total des encaissements affichés.
 */
export function listeEncaissements(
  encaissements: readonly EncaissementLivraisonResponse[],
  recherche: string,
): { lignes: EncaissementLivraisonResponse[]; total: number } {
  const lignes = filtrerRecherche(encaissements, recherche, (e) => [
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
