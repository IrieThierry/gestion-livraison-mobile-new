import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { CommandeStatusBadge } from '../../../../components/livreur/CommandeStatusBadge';
import { BoutonReceptions } from '../../../../components/livreur/BoutonReceptions';
import { useCommandesAReceptionner } from '../../../../features/commandes/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateShort } from '../../../../lib/format';

/**
 * Commandes confirmées ou en réception que le livreur peut réceptionner
 * (`GET /commande/a-receptionner`) : pour l'apprenti, seulement celles qui lui
 * sont affectées. La réception et « Passer à Livrée » se font depuis le détail.
 */
export default function CommandesAReceptionner() {
  const user = useAuthStore((s) => s.user);
  const q = useCommandesAReceptionner(!!user);

  if (!user) return null;

  const commandes = q.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="À réceptionner"
        subtitle={`${commandes.length} commande${commandes.length > 1 ? 's' : ''}`}
        fallback="/(livreur)/cash"
      />

      <FlatList
        data={commandes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <Text className="text-red-600 dark:text-red-400 text-sm px-1 pt-4">
              {extractApiErrorMessage(q.error, 'Commandes indisponibles')}
            </Text>
          ) : (
            <EmptyState
              title={
                user.parentId
                  ? 'Aucune commande ne vous est affectée.'
                  : 'Aucune commande à réceptionner.'
              }
            />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: c }) => {
          const restant = c.produitsCommandes.reduce((s, l) => s + l.qteRestante, 0);
          return (
            <Pressable
              onPress={() => router.push(`/(livreur)/cash/commandes/${c.id}` as never)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 active:opacity-80"
            >
              <View className="flex-row items-center justify-between">
                <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                  {c.reference}
                </Text>
                <CommandeStatusBadge statut={c.statut} />
              </View>
              <Text className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">
                {c.fournisseur.libelle}
              </Text>
              <View className="flex-row items-center justify-between mt-1">
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                  {formatDateShort(c.date)}
                </Text>
                <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {restant} restant{restant > 1 ? 's' : ''} à recevoir
                </Text>
              </View>
              <BoutonReceptions commandeId={c.id} nombre={c.receptions.length} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}
