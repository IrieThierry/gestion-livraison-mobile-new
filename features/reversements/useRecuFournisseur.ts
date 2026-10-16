import { useMemo } from 'react';
import { useFournisseurProfil, useLivreursPartenaires } from '../fournisseur/hooks';
import { nomLivreur } from '../fournisseur/gestion';
import type { UUID } from '../../types/api';
import type { AnnuaireRecu } from './recu';
import { chargerDetailRecuFournisseur } from './recuDonnees';
import { usePartageRecuAvec } from './useRecu';

/**
 * FM3 : annuaire du reçu dans l'espace fournisseur, comme le portail web
 * (`useAnnuaireRecuFournisseur`) : ses livreurs partenaires (bénéficiaires),
 * complétés par la synthèse du mois, et lui-même comme payeur de toutes les
 * lignes (y compris les anciennes dont `beneficiaireId` désigne le livreur).
 */
export function useAnnuaireRecuFournisseur(
  aReverser: ReadonlyArray<{ livreurId: UUID; prenom?: string | null; nom?: string | null }>,
): AnnuaireRecu {
  const profil = useFournisseurProfil().data;
  const partenaires = useLivreursPartenaires().data;
  return useMemo(() => {
    const livreurs = new Map<UUID, { nom: string; apprenti: boolean }>();
    for (const x of aReverser) livreurs.set(x.livreurId, { nom: nomLivreur({ nom: x.nom ?? '', prenom: x.prenom }), apprenti: false });
    for (const p of partenaires ?? []) livreurs.set(p.livreur.id, { nom: nomLivreur(p.livreur), apprenti: false });
    return {
      client: () => null,
      livreur: (id) => livreurs.get(id) ?? null,
      fournisseur: () => profil?.libelle || null,
    };
  }, [aReverser, partenaires, profil]);
}

/** Partage du reçu d'un reversement du fournisseur (PDF et fenêtre de partage du téléphone). */
export function usePartagerRecuFournisseur(annuaire: AnnuaireRecu) {
  return usePartageRecuAvec(annuaire, chargerDetailRecuFournisseur);
}
