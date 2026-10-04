import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { LivraisonResponse } from '../../types/api';
import { qteRetournable, retoursApi, type CreerRetourClientRequest } from './api';
import { livraisonKeys } from '../livraisons/keys';
import { livraisonsApi } from '../livraisons/api';
import { stockKeys } from '../stock/keys';
import { encaissementKeys } from '../encaissements/keys';
import { clientKeys, encoursKeys } from '../clients/keys';
import { remiseKeys } from '../remise/keys';
import { reversementKeys } from '../reversements/keys';

/**
 * Le payload du retour porte des quantités ABSOLUES (`qteRetournee`,
 * `qteRetourneeEnStock`) et le back n'a pas de contrôle de version : partir
 * de la livraison en cache pourrait écraser un retour enregistré ailleurs
 * (web, ou retour précédent dont le refetch n'est pas fini). On recharge
 * donc la liste du livreur depuis le serveur, on revalide les quantités
 * retournables sur ces données fraîches, puis on construit le PUT dessus.
 */
export async function enregistrerRetourSurDonneesFraiches(
  qc: QueryClient,
  input: { livraison: LivraisonResponse; request: CreerRetourClientRequest },
): Promise<void> {
  const livreurId = input.livraison.livreur.id;
  const fraiches = await qc.fetchQuery({
    queryKey: livraisonKeys.byLivreur(livreurId),
    queryFn: () => livraisonsApi.byLivreur(livreurId),
    staleTime: 0,
  });
  const fraiche = fraiches.find((l) => l.id === input.livraison.id);
  if (!fraiche) throw new Error('Livraison introuvable, recharge la liste.');
  // Plusieurs saisies peuvent viser la même ligne : on cumule avant de comparer.
  const demande = new Map<string, number>();
  for (const l of input.request.lignes) {
    demande.set(l.produitLivraisonId, (demande.get(l.produitLivraisonId) ?? 0) + l.quantite);
  }
  for (const [id, quantite] of demande) {
    const p = fraiche.produitsLivraison?.find((x) => x.id === id);
    if (!p || quantite > qteRetournable(p)) {
      throw new Error('Quantité retournable dépassée (données mises à jour).');
    }
  }
  await retoursApi.enregistrer(fraiche, input.request);
}

/**
 * Mutation qui enregistre un retour client (`PUT /livraison`).
 *
 * Côté back (`ModifierLivraisonUseCase`, une transaction) :
 *  - `qteRetournee` et `qteRetourneeEnStock` des lignes sont mis à jour ;
 *  - le stock courant du livreur est ré-incrémenté de la part « remise en
 *    stock » uniquement (la part « perdue » ne revient pas en stock) ;
 *  - le dû du client baisse de (prix + remise) × quantité retournée.
 *
 * On invalide livraisons, stock, encaissements et clients (soldes).
 */
export function useEnregistrerRetour() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { livraison: LivraisonResponse; request: CreerRetourClientRequest }) =>
      enregistrerRetourSurDonneesFraiches(qc, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reversementKeys.all });
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
      qc.invalidateQueries({ queryKey: stockKeys.all });
      qc.invalidateQueries({ queryKey: encaissementKeys.all });
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: encoursKeys.all });
      qc.invalidateQueries({ queryKey: remiseKeys.all });
    },
    // Le payload est construit depuis la livraison en cache : après un échec
    // (409, livraison modifiée ailleurs…), on la recharge pour qu'une
    // nouvelle tentative parte de données fraîches.
    onError: () => {
      qc.invalidateQueries({ queryKey: livraisonKeys.all });
    },
  });
}
