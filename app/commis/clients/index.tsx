import { useRef } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { ChevronRight, PackageMinus } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { CARTE_COMMIS, SECTION_COMMIS } from '../../../components/commis/ElementsCommis';
import { useAnnulerSortie, useClientsCommis, useSortiesDuJour } from '../../../features/commis/hooks';
import { heure, nomPersonne } from '../../../features/commis/regles';
import { creerVerrou, lancerUneFois } from '../../../features/commandes/verrou';
import { useNetworkStore } from '../../../stores/networkStore';
import { naviguer } from '../../../lib/navigation-app';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { jourIso } from '../../../lib/periode';
import type { SortieCommisResponse } from '../../../types/api';

/**
 * Onglet Clients du commis : les clients actifs de son fournisseur (un appui
 * ouvre une sortie pour ce client) et les sorties du jour, annulables le jour
 * même (le lendemain, seul le fournisseur peut annuler : le message du serveur
 * est affiché). Aucun prix ni montant.
 */
export default function ClientsCommis() {
  const jour = jourIso(new Date());
  const clientsQ = useClientsCommis();
  const sortiesQ = useSortiesDuJour(jour);
  const annuler = useAnnulerSortie();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const clients = clientsQ.data ?? [];
  const sorties = sortiesQ.data ?? [];

  const onAnnuler = (s: SortieCommisResponse) =>
    dialog.confirm({
      title: 'Annuler cette sortie ?',
      message: `La sortie de ${heure(s.creeLe)} pour ${s.client.nom} sera annulée.`,
      confirmLabel: 'Annuler la sortie',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          annuler.mutate(s.id, {
            onSettled: fin,
            onSuccess: () => dialog.success('Sortie annulée'),
            onError: (e) => dialog.error('Annulation impossible', extractApiErrorMessage(e, 'La sortie n’a pas pu être annulée.')),
          }),
        ),
    });

  const relire = () => {
    void clientsQ.refetch();
    void sortiesQ.refetch();
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Clients" subtitle="Sorties aux clients de ton fournisseur" showBack={false} />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={(clientsQ.isFetching || sortiesQ.isFetching) && !clientsQ.isLoading} onRefresh={relire} tintColor="#047857" />}
      >
        <Pressable
          onPress={() => naviguer('/commis/clients/sortie')}
          accessibilityRole="button"
          accessibilityLabel="Nouvelle sortie"
          className="flex-row items-center justify-center gap-2 rounded-md py-3 bg-emerald-700 active:opacity-80"
        >
          <PackageMinus color="#fff" size={16} />
          <Text className="text-white font-bold text-[14px]">Nouvelle sortie</Text>
        </Pressable>

        <Text className={SECTION_COMMIS}>Sorties du jour</Text>
        {sortiesQ.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : sortiesQ.isError ? (
          <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(sortiesQ.error, 'Sorties indisponibles')}</Text>
        ) : sorties.length === 0 ? (
          <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucune sortie aujourd’hui.</Text>
        ) : (
          <View className="gap-2">
            {sorties.map((s) => (
              <View key={s.id} className={`${CARTE_COMMIS} p-3`}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">{`${s.client.nom} · ${heure(s.creeLe)}`}</Text>
                  {s.annulee ? (
                    <View className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                      <Text className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Annulée</Text>
                    </View>
                  ) : null}
                </View>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">{`Par ${nomPersonne(s.auteur)}`}</Text>
                {s.lignes.map((l) => (
                  <Text
                    key={l.produitFournisseurId}
                    className={`text-[12px] mt-0.5 ${s.annulee ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'}`}
                  >
                    {`${l.quantite} × ${l.designation}`}
                  </Text>
                ))}
                {!s.annulee ? (
                  <Pressable
                    onPress={() => onAnnuler(s)}
                    disabled={!isOnline}
                    accessibilityRole="button"
                    accessibilityLabel={`Annuler la sortie de ${s.client.nom} (${heure(s.creeLe)})`}
                    className="self-start mt-2 active:opacity-70"
                  >
                    <Text className={`text-[12px] font-bold ${isOnline ? 'text-red-600 dark:text-red-400' : 'text-slate-400'}`}>Annuler</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </View>
        )}

        <Text className={SECTION_COMMIS}>Clients</Text>
        {clientsQ.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : clientsQ.isError ? (
          <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(clientsQ.error, 'Clients indisponibles')}</Text>
        ) : clients.length === 0 ? (
          <Text className="text-[13px] italic text-slate-500 dark:text-slate-400">Aucun client actif.</Text>
        ) : (
          <View className={`${CARTE_COMMIS} overflow-hidden`}>
            {clients.map((c, i) => (
              <Pressable
                key={c.id}
                onPress={() => naviguer('/commis/clients/sortie', { clientId: c.id })}
                accessibilityRole="button"
                accessibilityLabel={`Nouvelle sortie pour ${c.nom}`}
                className={`flex-row items-center justify-between px-4 py-3 active:opacity-70 ${i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''}`}
              >
                <Text className="font-bold text-slate-900 dark:text-white">{c.nom}</Text>
                <ChevronRight color="#94a3b8" size={18} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
