import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { FilePen, Plus } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { SelecteurMois } from '../../../../components/fournisseur/SelecteurMois';
import { useDemandesModifFournisseurEnAttente, useVersementsFournisseur } from '../../../../features/fournisseur/hooks';
import { moisDe, nbDemandesADecider } from '../../../../features/fournisseur/regles';
import { livreurDuVersement, totauxVersements, trierVersements } from '../../../../features/fournisseur/argent';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateLong, formatDateShort, formatFCFA } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';

/**
 * F2 : versements reçus des livreurs (`GET /fournisseur/me/versements`), du
 * mois choisi ou de toutes les périodes, comme la page web : total et remise
 * livreur cumulée, puis une carte par versement avec « Demander une
 * modification ». Accès aux demandes de modification et à l'enregistrement.
 */
export default function VersementsRecus() {
  const [mois, setMois] = useState(() => moisDe());
  const [toutes, setToutes] = useState(false);
  const q = useVersementsFournisseur(toutes ? undefined : mois);
  const demandesQ = useDemandesModifFournisseurEnAttente();
  const aDecider = nbDemandesADecider(demandesQ.data);
  const versements = useMemo(() => trierVersements(q.data), [q.data]);
  const { total, remise } = totauxVersements(q.data);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Versements reçus"
        subtitle="Les versements faits par tes livreurs"
        right={
          <Pressable
            onPress={() => naviguer('/fournisseur/argent/versements/nouveau')}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer un versement"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Enregistrer</Text>
          </Pressable>
        }
      />

      <View className="px-4 gap-2">
        <Pressable
          onPress={() => naviguer('/fournisseur/argent/versements/demandes')}
          accessibilityRole="button"
          accessibilityLabel={`Demandes de modification : ${aDecider} à décider`}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 flex-row items-center gap-2 active:opacity-70"
        >
          <FilePen color="#7c3aed" size={16} />
          <Text className="flex-1 font-bold text-slate-800 dark:text-slate-200 text-[13px]">Demandes de modification</Text>
          {aDecider > 0 ? (
            <View className="bg-red-500 rounded-full px-2 py-0.5">
              <Text className="text-white text-[11px] font-bold">{aDecider > 99 ? '99+' : aDecider}</Text>
            </View>
          ) : null}
        </Pressable>

        <SelecteurMois mois={mois} onChange={setMois} desactive={toutes} />
        <Pressable
          onPress={() => setToutes((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ selected: toutes }}
          className={`self-center px-3 py-1.5 rounded-full border ${
            toutes ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          }`}
        >
          <Text className={`text-[12px] font-bold ${toutes ? 'text-white' : 'text-slate-700 dark:text-slate-300'}`}>
            {toutes ? 'Filtrer par mois' : 'Toutes périodes'}
          </Text>
        </Pressable>

        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">{toutes ? 'Total cumulé' : 'Total du mois'}</Text>
          <Text className="font-extrabold text-xl text-slate-900 dark:text-white">{formatFCFA(total)} F</Text>
          <Text className="text-[11px] text-amber-700 dark:text-amber-400">
            dont remise livreur : {formatFCFA(remise)} F
          </Text>
        </View>
      </View>

      <FlatList
        data={versements}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={!!q.isFetching && !q.isLoading}
            onRefresh={() => {
              q.refetch();
              demandesQ.refetch();
            }}
            tintColor="#047857"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(q.error, 'Impossible de charger les versements.')}
            />
          ) : (
            <EmptyState
              title="Aucun versement"
              message={toutes ? 'Pas encore de versements reçus.' : 'Pas de versement sur ce mois.'}
            />
          )
        }
        renderItem={({ item: v }) => (
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2">
            <View className="flex-row items-start justify-between gap-2">
              <View className="flex-1">
                <Text className="font-extrabold text-slate-900 dark:text-white">{livreurDuVersement(v)}</Text>
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {`Le ${formatDateLong(v.dateVersement)} · livraisons du ${formatDateShort(v.dateDebut)} au ${formatDateShort(v.dateFin)}`}
                </Text>
              </View>
              <Text className="font-extrabold text-emerald-800 dark:text-emerald-400">
                {formatFCFA(Number(v.montantVerse))} F
              </Text>
            </View>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {`Valeur achat ${formatFCFA(Number(v.valeurAchat))} F · remise livreur ${formatFCFA(Number(v.remiseLivreurCumulee))} F`}
            </Text>
            {v.commentaire ? (
              <Text className="text-[11px] italic text-slate-500 dark:text-slate-400 mt-0.5">{v.commentaire}</Text>
            ) : null}
            <Pressable
              onPress={() => naviguer('/fournisseur/argent/versements/modifier', { versementId: v.id })}
              accessibilityRole="button"
              accessibilityLabel={`Demander une modification du versement de ${livreurDuVersement(v)}`}
              className="self-start mt-2 flex-row items-center gap-1 active:opacity-70"
            >
              <FilePen color="#2563eb" size={13} />
              <Text className="text-[12px] font-bold text-blue-600 dark:text-blue-400">Demander une modification</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}
