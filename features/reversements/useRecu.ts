import { useCallback, useMemo, useRef } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useApprentis } from '../apprentis/hooks';
import { useClientsByLivreur, useEncoursByLivreur } from '../clients/hooks';
import { useFournisseurs } from '../lookups/hooks';
import { nomPersonne } from '../etats/calculs/commun';
import { creerVerrou, lancerUneFois } from '../commandes/verrou';
import { dialog } from '../../lib/dialog';
import type { ReversementRecord, UUID } from '../../types/api';
import {
  NON_PRECISE,
  partiesReversement,
  recuReversement,
  type AnnuaireRecu,
  type PartieRecu,
} from './recu';
import { partagerRecu } from './partageRecu';

/**
 * Annuaire des noms connus du livreur connecté pour éditer un reçu : ses
 * clients (liste et encours), lui-même et ses apprentis, les fournisseurs.
 */
export function useAnnuaireRecu(): AnnuaireRecu {
  const user = useAuthStore((s) => s.user);
  const qClients = useClientsByLivreur(user?.id);
  const qEncours = useEncoursByLivreur(user?.id);
  const qApprentis = useApprentis();
  const qFournisseurs = useFournisseurs();

  return useMemo(() => {
    const clients = new Map<UUID, string>();
    for (const e of qEncours.data ?? []) if (e.nomClient) clients.set(e.clientId, e.nomClient);
    for (const c of qClients.data ?? []) {
      const nom = nomPersonne(c);
      if (nom) clients.set(c.id, nom);
    }
    const livreurs = new Map<UUID, { nom: string; apprenti: boolean }>();
    if (user) livreurs.set(user.id, { nom: nomPersonne(user), apprenti: !!user.parentId });
    for (const a of qApprentis.data ?? []) livreurs.set(a.id, { nom: nomPersonne(a), apprenti: true });
    const fournisseurs = new Map<UUID, string>();
    for (const f of qFournisseurs.data ?? []) if (f.libelle) fournisseurs.set(f.id, f.libelle);
    return {
      client: (id) => clients.get(id) ?? null,
      livreur: (id) => livreurs.get(id) ?? null,
      fournisseur: (id) => fournisseurs.get(id) ?? null,
    };
  }, [user, qClients.data, qEncours.data, qApprentis.data, qFournisseurs.data]);
}

/**
 * Partage du reçu d'un reversement (PDF + fenêtre de partage). `connu`
 * complète l'annuaire avec un nom déjà affiché à l'écran (ex. le bénéficiaire
 * choisi dans la synthèse). Un double appui n'ouvre qu'un partage.
 */
export function usePartagerRecu() {
  const annuaire = useAnnuaireRecu();
  const verrou = useRef(creerVerrou()).current;
  return useCallback(
    (r: ReversementRecord, connu?: { beneficiaire?: string; payeur?: string }) => {
      lancerUneFois(verrou, (fin) => {
        // Tout dans la promesse : une erreur synchrone (donnée inattendue)
        // est affichée et le verrou est toujours libéré.
        Promise.resolve()
          .then(() => {
            const parties = partiesReversement(r, annuaire);
            const completer = (p: PartieRecu, nom?: string): PartieRecu =>
              nom && p.nom === NON_PRECISE ? { ...p, nom } : p;
            const recu = recuReversement(r, {
              beneficiaire: completer(parties.beneficiaire, connu?.beneficiaire),
              payeur: completer(parties.payeur, connu?.payeur),
            });
            return partagerRecu(recu);
          })
          .catch((e: unknown) =>
            dialog.error(
              'Partage impossible',
              e instanceof Error && e.message ? e.message : 'Le reçu n’a pas pu être généré.',
            ),
          )
          .finally(fin);
      });
    },
    [annuaire, verrou],
  );
}
