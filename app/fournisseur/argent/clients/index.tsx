import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { couleurDu, useClientsFournisseur } from '../../../../features/fournisseur/clients';
import { filtrerRecherche, AUCUN_RESULTAT } from '../../../../lib/recherche';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatFCFA } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';
import type { ClientFournisseurResponse } from '../../../../types/api';

/**
 * Argent → Mes clients : les clients du guichet et ce qu'ils doivent (dû en
 * rouge quand il est positif). Une ligne ouvre la fiche du client : sorties,
 * versements, prix, versement.
 */
export default function MesClients() {
  const q = useClientsFournisseur();
  const [recherche, setRecherche] = useState('');
  const visibles = useMemo(
    () =>
      filtrerRecherche([...(q.data ?? [])].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')), recherche, (c) => [c.nom, c.contact]),
    [q.data, recherche],
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes clients"
        subtitle="Ce que tes clients du guichet te doivent"
        right={
          <Pressable
            onPress={() => naviguer('/fournisseur/argent/clients/nouveau')}
            accessibilityRole="button"
            accessibilityLabel="Nouveau client"
            className="bg-emerald-700 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />
      {(q.data?.length ?? 0) > 0 ? (
        <View className="px-4 pb-2">
          <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Nom ou téléphone…" />
        </View>
      ) : null}
      <FlatList
        data={visibles}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#047857" />
            </View>
          ) : q.isError ? (
            <View className="pt-4 px-1 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Clients indisponibles')}</Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : recherche.trim() ? (
            <Text className="text-slate-400 dark:text-slate-500 text-sm text-center pt-6">{AUCUN_RESULTAT}</Text>
          ) : (
            <EmptyState
              title="Aucun client."
              message="Ajoute les clients du guichet : tes commis pourront leur enregistrer des sorties."
            />
          )
        }
        ListFooterComponent={
          visibles.length > 0 ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
              Dû : total des sorties du client (au prix figé à la sortie) moins ses versements.
            </Text>
          ) : null
        }
        renderItem={({ item }) => <LigneClient client={item} />}
      />
    </View>
  );
}

function LigneClient({ client: c }: { client: ClientFournisseurResponse }) {
  const rouge = couleurDu(c.du) === 'rouge';
  return (
    <Pressable
      onPress={() => naviguer(`/fournisseur/argent/clients/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir ${c.nom}`}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2 flex-row items-center gap-3 active:opacity-80"
    >
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]" numberOfLines={1}>
            {c.nom}
          </Text>
          {!c.actif ? (
            <View className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              <Text className="text-[9px] font-bold text-slate-500 dark:text-slate-400">INACTIF</Text>
            </View>
          ) : null}
        </View>
        {c.contact ? <Text className="text-[11px] text-slate-500 dark:text-slate-400">{c.contact}</Text> : null}
      </View>
      <Text
        accessibilityLabel={`Dû de ${c.nom}`}
        className={`font-extrabold text-[13px] ${rouge ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}
      >
        {`${formatFCFA(c.du)} F`}
      </Text>
      <ChevronRight color="#94a3b8" size={16} />
    </Pressable>
  );
}
