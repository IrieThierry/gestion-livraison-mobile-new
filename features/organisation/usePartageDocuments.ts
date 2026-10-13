import { useCallback, useRef, useState } from 'react';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import { creerVerrou, lancerUneFois } from '../commandes/verrou';
import type { FactureResponse, UUID } from '../../types/api';
import { organisationApi } from './api';
import { partagerAvoir, partagerFacture } from './partageDocument';

export const MESSAGE_FACTURE_INTROUVABLE = 'Aucune facture n’a été trouvée pour cette vente.';

/**
 * Partage des factures et avoirs (PDF + fenêtre de partage). Un seul partage
 * à la fois (double appui ignoré) ; `enCours` porte l'identifiant du document
 * (ou de la vente) en préparation, pour le bouton occupé. Une erreur (lecture
 * refusée, partage indisponible) s'affiche avec son message.
 */
export function usePartageDocuments() {
  const verrou = useRef(creerVerrou()).current;
  const [enCours, setEnCours] = useState<string | null>(null);

  const lancer = useCallback(
    (cle: string, preparer: () => Promise<unknown>) =>
      lancerUneFois(verrou, (fin) => {
        setEnCours(cle);
        Promise.resolve()
          .then(preparer)
          .catch((e: unknown) =>
            dialog.error('Partage impossible', extractApiErrorMessage(e, 'Le document n’a pas pu être généré.')),
          )
          .finally(() => {
            setEnCours(null);
            fin();
          });
      }),
    [verrou],
  );

  /** Facture déjà lue (liste « Mes factures »). */
  const facture = useCallback((f: FactureResponse) => lancer(f.id, () => partagerFacture(f)), [lancer]);

  /** Facture d'une vente, relue (situation actuelle) : juste après la vente ou depuis sa fiche. */
  const factureDeLivraison = useCallback(
    (livraisonId: UUID) =>
      lancer(livraisonId, async () => {
        const f = await organisationApi.factureDeLivraison(livraisonId);
        if (!f) throw new Error(MESSAGE_FACTURE_INTROUVABLE);
        await partagerFacture(f);
      }),
    [lancer],
  );

  /** Avoir lu par son identifiant (retour produit, liste des avoirs). */
  const avoir = useCallback(
    (avoirId: UUID) => lancer(avoirId, async () => partagerAvoir(await organisationApi.avoir(avoirId))),
    [lancer],
  );

  return { enCours, facture, factureDeLivraison, avoir };
}

/**
 * Délai avant d'ouvrir la feuille de partage depuis un bouton du dialogue :
 * iOS refuse de la présenter pendant l'animation de fermeture.
 */
export const DELAI_FERMETURE_DIALOGUE_MS = 350;

export function apresFermetureDialogue(action: () => void): void {
  setTimeout(action, DELAI_FERMETURE_DIALOGUE_MS);
}
