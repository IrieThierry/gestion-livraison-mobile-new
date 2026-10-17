import { useRef } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { CheckCheck, PackagePlus } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { FormScreen } from '../../../components/shared/FormScreen';
import { CARTE_COMMIS, CarteRemise, SECTION_COMMIS, TableauQuantites } from '../../../components/commis/ElementsCommis';
import {
  useAnnulerRemise,
  useCommandesCommis,
  useRemisesCommande,
  useTerminerCommande,
} from '../../../features/commis/hooks';
import { dateHeure, libelleStatutCommande, nomPersonne } from '../../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { ACCUEIL_COMMIS } from '../../../lib/navigation';
import { naviguer, ouvrir } from '../../../lib/navigation-app';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import type { RemiseCommisResponse } from '../../../types/api';

/**
 * Détail d'une commande (commis) : par produit, commandé / remis (confirmé) /
 * en attente ; ses remises (en attente de confirmation : Annuler ; refusées :
 * le motif du livreur) ; « Nouvelle remise » et « Commande terminée » (avec
 * confirmation ; les refus du serveur sont affichés tels quels). Ouvert aussi
 * par la notification d'une remise refusée.
 */
export default function CommandeCommis() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const commandesQ = useCommandesCommis();
  const remisesQ = useRemisesCommande(id);
  const annuler = useAnnulerRemise();
  const terminer = useTerminerCommande();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrouAnnuler = useRef(creerVerrou()).current;
  const verrouTerminer = useRef(creerVerrou()).current;

  const commande = commandesQ.data?.find((c) => c.id === id);
  const remises = remisesQ.data ?? [];
  const numero = commande?.numero ?? remises[0]?.commandeNumero;
  const livreur = commande?.livreur ?? remises[0]?.livreur;

  const relire = () => {
    void commandesQ.refetch();
    void remisesQ.refetch();
  };

  const onAnnuler = (r: RemiseCommisResponse) =>
    dialog.confirm({
      title: 'Annuler cette remise ?',
      message: `La remise du ${dateHeure(r.creeLe)} ne sera plus proposée au livreur.`,
      confirmLabel: 'Annuler la remise',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrouAnnuler, (fin) =>
          annuler.mutate(r.id, {
            onSettled: fin,
            onSuccess: () => dialog.success('Remise annulée'),
            onError: (e) => dialog.error('Annulation impossible', extractApiErrorMessage(e, 'La remise n’a pas pu être annulée.')),
          }),
        ),
    });

  const onTerminer = () =>
    dialog.confirm({
      title: 'Commande terminée ?',
      message: `La commande ${numero ?? ''} passera à « Livrée » avec ce qui a été remis et confirmé par le livreur. Tu ne pourras plus y ajouter de remise.`,
      confirmLabel: 'Commande terminée',
      onConfirm: () =>
        lancerUneFois(verrouTerminer, (fin) =>
          terminer.mutate(id!, {
            onSettled: fin,
            onSuccess: () => {
              dialog.success('Commande terminée', 'Le livreur est prévenu.');
              ouvrir(ACCUEIL_COMMIS);
            },
            onError: (e) => dialog.error('Action impossible', extractApiErrorMessage(e, 'La commande n’a pas pu être terminée.')),
          }),
        ),
    });

  const actif = isOnline && !!commande;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={numero ?? 'Commande'} subtitle={livreur ? nomPersonne(livreur) : undefined} />
      <FormScreen
        refreshControl={
          <RefreshControl refreshing={(commandesQ.isFetching || remisesQ.isFetching) && !commandesQ.isLoading} onRefresh={relire} tintColor="#047857" />
        }
      >
        <View className="px-4">
          {commandesQ.isLoading ? (
            <View className="items-center py-6">
              <ActivityIndicator color="#047857" />
            </View>
          ) : commandesQ.isError ? (
            <Text className="text-red-600 dark:text-red-400 text-sm pt-2">{extractApiErrorMessage(commandesQ.error, 'Commande indisponible')}</Text>
          ) : !commande ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400 pt-2">
              Cette commande n’est plus à servir (terminée ou annulée).
            </Text>
          ) : (
            <>
              <View className={`${CARTE_COMMIS} p-3 mt-2`}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-[11px] text-slate-500 dark:text-slate-400">{dateHeure(commande.date)}</Text>
                  <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{libelleStatutCommande(commande.statut)}</Text>
                </View>
                <TableauQuantites lignes={commande.lignes} />
              </View>
              <View className="gap-2 mt-3">
                <Pressable
                  onPress={() => naviguer('/commis/commandes/remise', { commandeId: commande.id })}
                  disabled={!actif}
                  accessibilityRole="button"
                  accessibilityLabel="Nouvelle remise"
                  className={`flex-row items-center justify-center gap-2 rounded-md py-3 ${actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
                >
                  <PackagePlus color="#fff" size={16} />
                  <Text className="text-white font-bold text-[14px]">Nouvelle remise</Text>
                </Pressable>
                <Pressable
                  onPress={onTerminer}
                  disabled={!actif || terminer.isPending}
                  accessibilityRole="button"
                  accessibilityLabel="Commande terminée"
                  className={`flex-row items-center justify-center gap-2 rounded-md py-3 border ${
                    actif ? 'border-sky-600 active:opacity-80' : 'border-slate-300 dark:border-slate-700'
                  }`}
                >
                  {terminer.isPending ? (
                    <ActivityIndicator color="#0284c7" />
                  ) : (
                    <>
                      <CheckCheck color={actif ? '#0284c7' : '#94a3b8'} size={16} />
                      <Text className={`font-bold text-[14px] ${actif ? 'text-sky-700 dark:text-sky-400' : 'text-slate-400'}`}>Commande terminée</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </>
          )}

          <Text className={SECTION_COMMIS}>Remises</Text>
          {remisesQ.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : remises.length === 0 ? (
            <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucune remise pour cette commande.</Text>
          ) : (
            <View className="gap-2">
              {remises.map((r) => (
                <CarteRemise key={r.id} remise={r} onAnnuler={onAnnuler} annulationActive={isOnline} />
              ))}
            </View>
          )}
        </View>
      </FormScreen>
    </View>
  );
}
