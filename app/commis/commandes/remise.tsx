import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { FormScreen } from '../../../components/shared/FormScreen';
import { BoutonEnvoyer, SaisieProduits } from '../../../components/commis/ElementsCommis';
import { useCatalogueCommis, useCommandesCommis, useRemettre } from '../../../features/commis/hooks';
import { lignesSaisies, nomPersonne, resumeLignes, saisieEnvoyable } from '../../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { retourParent } from '../../../lib/navigation-app';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import type { UUID } from '../../../types/api';

/**
 * Nouvelle remise sur une commande : une quantité par produit de la commande
 * (elle peut dépasser le commandé), plus des produits du catalogue hors
 * commande (« Ajouter un produit »). Les quantités vides ou 0 sont ignorées ;
 * rien de saisi → Envoyer désactivé. Confirmation résumée avant l'envoi, un
 * seul envoi malgré un double appui. La remise attend ensuite la confirmation
 * du livreur.
 */
export default function RemiseCommande() {
  const { commandeId } = useLocalSearchParams<{ commandeId: string }>();
  const pathname = usePathname();
  const commande = useCommandesCommis().data?.find((c) => c.id === commandeId);
  const catalogue = useCatalogueCommis().data ?? [];
  const m = useRemettre();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [quantites, setQuantites] = useState<Record<UUID, string>>({});
  const [ajoutes, setAjoutes] = useState<UUID[]>([]);

  const lignesCommande = commande?.lignes ?? [];
  const saisie = lignesSaisies(quantites, [...lignesCommande.map((l) => l.produitFournisseurId), ...ajoutes]);
  const actif = isOnline && !!commande && saisieEnvoyable(saisie) && !m.isPending;

  const envoyer = () => {
    if (!actif || !commande) return;
    const noms = new Map<UUID, string>([
      ...catalogue.map((p) => [p.produitFournisseurId, p.designation] as [UUID, string]),
      ...lignesCommande.map((l) => [l.produitFournisseurId, l.designation] as [UUID, string]),
    ]);
    const lignes = saisie.lignes;
    dialog.confirm({
      title: 'Envoyer cette remise ?',
      message: `À ${nomPersonne(commande.livreur)} pour ${commande.numero} :\n${resumeLignes(lignes, noms)}\n\nLe livreur devra confirmer cette remise.`,
      confirmLabel: 'Envoyer',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          m.mutate(
            { commandeId: commande.id, lignes },
            {
              onSuccess: () => {
                retourParent(pathname);
                dialog.success('Remise envoyée', 'Elle attend la confirmation du livreur.');
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
      <PageHeader
        title="Nouvelle remise"
        subtitle={commande ? `${commande.numero} · ${nomPersonne(commande.livreur)}` : 'Commande introuvable'}
      />
      <FormScreen>
        <View className="px-4 pt-2 gap-3">
          <Text className="text-[12px] text-slate-500 dark:text-slate-400">
            Saisis les quantités remises au livreur. Une quantité vide ou à 0 est ignorée.
          </Text>
          <SaisieProduits
            lignesCommande={lignesCommande}
            catalogue={catalogue}
            ajoutes={ajoutes}
            onAjoutes={setAjoutes}
            quantites={quantites}
            onQuantites={setQuantites}
          />
          <BoutonEnvoyer label="Envoyer la remise" actif={actif} enCours={m.isPending} onPress={envoyer} />
        </View>
      </FormScreen>
    </View>
  );
}
