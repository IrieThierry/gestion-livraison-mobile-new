import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { FormScreen } from '../../components/shared/FormScreen';
import { BoutonEnvoyer, ChoixParmi, SECTION_COMMIS, SaisieProduits } from '../../components/commis/ElementsCommis';
import { useCatalogueCommis, useLivreursCommis, useRemettreSansCommande } from '../../features/commis/hooks';
import { lignesSaisies, nomPersonne, resumeLignes, saisieEnvoyable } from '../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { useNetworkStore } from '../../stores/networkStore';
import { ouvrir } from '../../lib/navigation-app';
import { dialog } from '../../lib/dialog';
import { extractApiErrorMessage } from '../../lib/api-error';
import type { UUID } from '../../types/api';

/**
 * Remise sans commande : le commis choisit un livreur titulaire partenaire
 * (jamais un apprenti), puis les produits et quantités. Le back crée la
 * commande, confirmée, avec ces quantités ; la remise attend la confirmation
 * du livreur. Après l'envoi, la commande créée s'ouvre.
 */
export default function RemiseSansCommande() {
  const livreursQ = useLivreursCommis();
  const catalogue = useCatalogueCommis().data ?? [];
  const m = useRemettreSansCommande();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [livreurId, setLivreurId] = useState<UUID | null>(null);
  const [quantites, setQuantites] = useState<Record<UUID, string>>({});
  const [ajoutes, setAjoutes] = useState<UUID[]>([]);

  const livreurs = livreursQ.data ?? [];
  const livreur = livreurs.find((l) => l.id === livreurId);
  const saisie = lignesSaisies(quantites, ajoutes);
  const actif = isOnline && !!livreur && saisieEnvoyable(saisie) && !m.isPending;

  const envoyer = () => {
    if (!actif || !livreur) return;
    const noms = new Map<UUID, string>(catalogue.map((p) => [p.produitFournisseurId, p.designation] as [UUID, string]));
    const lignes = saisie.lignes;
    dialog.confirm({
      title: 'Envoyer cette remise ?',
      message: `À ${nomPersonne(livreur)} (nouvelle commande) :\n${resumeLignes(lignes, noms)}\n\nUne commande confirmée sera créée ; le livreur devra confirmer cette remise.`,
      confirmLabel: 'Envoyer',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          m.mutate(
            { livreurId: livreur.id, lignes },
            {
              onSuccess: (r) => {
                dialog.success('Remise envoyée', 'Elle attend la confirmation du livreur.');
                ouvrir(`/commis/commandes/${r.commandeId}`);
              },
              onError: (e) => dialog.error('Remise impossible', extractApiErrorMessage(e, 'La remise n’a pas pu être envoyée.')),
              onSettled: fin,
            },
          ),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Remise sans commande" subtitle="La commande du livreur est créée à l’envoi" />
      <FormScreen>
        <View className="px-4 pt-2">
          <Text className={SECTION_COMMIS}>Livreur</Text>
          {livreursQ.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : livreurs.length === 0 ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucun livreur partenaire.</Text>
          ) : (
            <ChoixParmi
              options={livreurs.map((l) => ({ id: l.id, label: nomPersonne(l) }))}
              valeur={livreurId}
              onChange={setLivreurId}
            />
          )}
          <Text className={SECTION_COMMIS}>Produits</Text>
          <SaisieProduits catalogue={catalogue} ajoutes={ajoutes} onAjoutes={setAjoutes} quantites={quantites} onQuantites={setQuantites} />
          <BoutonEnvoyer label="Envoyer la remise" actif={actif} enCours={m.isPending} onPress={envoyer} />
        </View>
      </FormScreen>
    </View>
  );
}
