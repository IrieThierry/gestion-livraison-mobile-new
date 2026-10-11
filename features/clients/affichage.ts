import type { ClientResponse, EncoursClientResponse, UUID } from '../../types/api';
import { formatMontant } from '../../lib/format';
import type { ChampRecherche } from '../../lib/recherche';

type ClientAffiche = Pick<ClientResponse, 'id' | 'nom' | 'prenom' | 'contact'> & {
  quartier?: { libelle?: string | null } | null;
};

/** « Prénom Nom » (sans espaces superflus). */
export function nomClient(c: Pick<ClientResponse, 'nom' | 'prenom'>): string {
  return `${c.prenom ?? ''} ${c.nom ?? ''}`.replace(/\s+/g, ' ').trim();
}

/** Soldes serveur par client (encours du livreur). */
export function soldesParClient(
  encours: readonly EncoursClientResponse[] | null | undefined,
): Map<UUID, number> {
  const m = new Map<UUID, number>();
  for (const e of encours ?? []) {
    const s = Number(e.solde);
    if (Number.isFinite(s)) m.set(e.clientId, s);
  }
  return m;
}

/**
 * « Dû X FCFA » si solde > 0, « Avance X FCFA » si < 0 ; null si nul ou
 * inconnu (encours non chargé).
 */
export function libelleSoldeClient(solde: number | null | undefined): string | null {
  if (solde === null || solde === undefined || !Number.isFinite(solde) || solde === 0) return null;
  return solde > 0
    ? `Dû ${formatMontant(solde)} FCFA`
    : `Avance ${formatMontant(Math.abs(solde))} FCFA`;
}

/** Ligne secondaire : « quartier · contact · Dû X FCFA » (parties vides omises). */
export function indiceClient(c: ClientAffiche, solde?: number | null): string {
  return [c.quartier?.libelle?.trim(), c.contact?.trim(), libelleSoldeClient(solde)]
    .filter((p): p is string => !!p)
    .join(' · ');
}

/** Champs sur lesquels porte la recherche d'un client : nom, prénom, quartier, contact. */
export function champsRechercheClient(c: ClientAffiche): ChampRecherche[] {
  return [c.nom, c.prenom, c.quartier?.libelle, c.contact];
}

/** Option de liste déroulante pour un client (ordre d'entrée conservé). */
export function optionsClients(
  clients: readonly ClientAffiche[],
  soldes?: Map<UUID, number>,
): Array<{ id: UUID; label: string; hint?: string; motsCles: ChampRecherche[] }> {
  return clients.map((c) => {
    const hint = indiceClient(c, soldes?.get(c.id));
    return {
      id: c.id,
      label: nomClient(c),
      ...(hint ? { hint } : {}),
      motsCles: champsRechercheClient(c),
    };
  });
}
