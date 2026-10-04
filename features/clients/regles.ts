import type { ClientResponse, ModifierClientRequest, UUID } from '../../types/api';
import { formatMontant } from '../../lib/format';

export interface ChampsClientModifies {
  prenom: string;
  nom: string;
  contact: string;
  email: string;
  adresse: string;
  latitudeLongitude: string;
  quartierId: UUID;
  categorieId: UUID;
  avecOuSansRemise: boolean;
}

/**
 * Payload de modification : les champs non saisis à l'écran gardent leur
 * valeur ACTUELLE (prix par défaut, limite de crédit) et le client reste
 * rattaché à son livreur (pas au livreur connecté). `limiteCredit` est omis
 * quand elle n'existe pas : le back conserve alors la valeur stockée.
 */
export function buildModifierClientPayload(
  client: ClientResponse,
  champs: ChampsClientModifies,
  livreurConnecteId: UUID,
): ModifierClientRequest {
  const payload: ModifierClientRequest = {
    id: client.id,
    livreurId: client.livreur?.id ?? livreurConnecteId,
    ...champs,
  };
  // Même règle que limiteCredit : un prix par défaut absent n'est pas
  // transformé en 0, il est omis et le back garde la valeur stockée.
  if (client.prixDeVenteProduitParDefault != null) {
    payload.prixDeVenteProduitParDefault = client.prixDeVenteProduitParDefault;
  }
  if (client.limiteCredit != null) payload.limiteCredit = client.limiteCredit;
  return payload;
}

/** Limite de crédit saisie : entier >= 0, vide = 0. */
export function parseLimiteCredit(brut: string): number | null {
  const s = brut.replace(/\s/g, '');
  if (s === '') return 0;
  return /^\d+$/.test(s) ? Number(s) : null;
}

/** Libellé de la limite de crédit : 0, vide ou négative = sans limite (D13). */
export function libelleLimiteCredit(limite: number | null | undefined): string {
  return limite != null && limite > 0 ? `${formatMontant(limite)} F` : 'Sans limite';
}
