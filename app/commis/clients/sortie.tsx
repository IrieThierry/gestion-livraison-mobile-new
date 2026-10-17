import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { FormScreen } from '../../../components/shared/FormScreen';
import { BoutonEnvoyer, ChoixParmi, SECTION_COMMIS, SaisieProduits } from '../../../components/commis/ElementsCommis';
import { useCatalogueCommis, useClientsCommis, useSortir } from '../../../features/commis/hooks';
import { lignesSaisies, resumeLignes, saisieEnvoyable } from '../../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { retourParent } from '../../../lib/navigation-app';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import type { UUID } from '../../../types/api';

/**
 * Sortie client (guichet ou autre client du fournisseur) : le client, puis les
 * produits et quantités. Pas de confirmation du client ; le prix est figé par
 * le back (le commis ne le voit pas). Annulable le jour même depuis Clients.
 */
export default function SortieClient() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const pathname = usePathname();
  const clientsQ = useClientsCommis();
  const catalogue = useCatalogueCommis().data ?? [];
  const m = useSortir();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [clientId, setClientId] = useState<UUID | null>(params.clientId ?? null);
  const [quantites, setQuantites] = useState<Record<UUID, string>>({});
  const [ajoutes, setAjoutes] = useState<UUID[]>([]);

  const clients = clientsQ.data ?? [];
  const client = clients.find((c) => c.id === clientId);
  const saisie = lignesSaisies(quantites, ajoutes);
  const actif = isOnline && !!client && saisieEnvoyable(saisie) && !m.isPending;

  const envoyer = () => {
    if (!actif || !client) return;
    const noms = new Map<UUID, string>(catalogue.map((p) => [p.produitFournisseurId, p.designation] as [UUID, string]));
    const lignes = saisie.lignes;
    dialog.confirm({
      title: 'Enregistrer cette sortie ?',
      message: `Sortie pour ${client.nom} :\n${resumeLignes(lignes, noms)}\n\nTu pourras l’annuler aujourd’hui seulement.`,
      confirmLabel: 'Enregistrer',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          m.mutate(
            { clientId: client.id, lignes },
            {
              onSuccess: () => {
                retourParent(pathname);
                dialog.success('Sortie enregistrée');
              },
              onError: (e) => dialog.error('Sortie impossible', extractApiErrorMessage(e, 'La sortie n’a pas pu être enregistrée.')),
              onSettled: fin,
            },
          ),
        ),
    });
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle sortie" subtitle={client ? client.nom : 'Produits remis à un client'} />
      <FormScreen>
        <View className="px-4 pt-2">
          <Text className={SECTION_COMMIS}>Client</Text>
          {clientsQ.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : clients.length === 0 ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucun client actif.</Text>
          ) : (
            <ChoixParmi options={clients.map((c) => ({ id: c.id, label: c.nom }))} valeur={clientId} onChange={setClientId} />
          )}
          <Text className={SECTION_COMMIS}>Produits</Text>
          <SaisieProduits catalogue={catalogue} ajoutes={ajoutes} onAjoutes={setAjoutes} quantites={quantites} onQuantites={setQuantites} />
          <BoutonEnvoyer label="Enregistrer la sortie" actif={actif} enCours={m.isPending} onPress={envoyer} />
        </View>
      </FormScreen>
    </View>
  );
}
