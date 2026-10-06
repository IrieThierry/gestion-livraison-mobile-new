import type { ClientResponse, CreerClientRequest, ModifierClientRequest, UUID } from '../../types/api';

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
 * D20 : le statut avec/sans remise et le prix par défaut sont réservés au
 * livreur racine / admin. Pour un apprenti ils sont omis du payload (le back
 * les ignorerait de toute façon).
 */

/**
 * Payload de modification : les champs non saisis à l'écran gardent leur
 * valeur stockée côté back et le client reste rattaché à son livreur (pas au
 * livreur connecté). `limiteCredit` (abandonnée) et
 * `prixDeVenteProduitParDefault` ne sont JAMAIS envoyés : le back conserve les
 * valeurs stockées à la modification.
 */
export function buildModifierClientPayload(
  client: ClientResponse,
  champs: ChampsClientModifies,
  livreurConnecteId: UUID,
  conditionsFixables = true,
): ModifierClientRequest {
  const { avecOuSansRemise, ...autresChamps } = champs;
  const payload: ModifierClientRequest = {
    id: client.id,
    livreurId: client.livreur?.id ?? livreurConnecteId,
    ...autresChamps,
    ...(conditionsFixables ? { avecOuSansRemise } : {}),
  };
  return payload;
}

export interface ChampsClientCree {
  prenom: string;
  nom: string;
  contact: string;
  email: string;
  adresse: string;
  latitudeLongitude: string;
  quartierId: UUID;
  categorieId: UUID;
  avecRemise: boolean;
}

/**
 * Payload de création : ni prix par défaut ni limite de crédit ne sont envoyés
 * (le back applique ses défauts ; les lignes de livraison partent du prix du
 * produit, tous les clients sont « sans limite »). Le statut remise
 * n'est transmis que par un livreur racine / admin (D20), sinon false.
 */
export function buildCreerClientPayload(
  champs: ChampsClientCree,
  livreurId: UUID,
  conditionsFixables: boolean,
): CreerClientRequest {
  return {
    nom: champs.nom,
    prenom: champs.prenom,
    contact: champs.contact,
    email: champs.email,
    adresse: champs.adresse,
    latitudeLongitude: champs.latitudeLongitude,
    quartierId: champs.quartierId,
    categorieId: champs.categorieId,
    livreurId,
    avecOuSansRemise: conditionsFixables && champs.avecRemise,
  };
}
