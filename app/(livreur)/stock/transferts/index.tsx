import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Plus, ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useTransfertsParent } from '../../../../features/transferts/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { formatDateShort } from '../../../../lib/format';

/**
 * Liste des transferts effectués au sein de l'équipe (root + apprentis).
 * Utilise `GET /transfert-stock/parent/{parentId}` côté back, qui renvoie
 * tous les transferts dont la source OU le destinataire appartient à
 * l'équipe du parent.
 */
export default function TransfertsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useTransfertsParent(livreurId);

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Transferts de stock"
        subtitle={`${q.data?.length ?? 0} transfert${(q.data?.length ?? 0) > 1 ? 's' : ''}`}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/stock/transferts/nouveau' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      <FlatList
        data={q.data ?? []}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Aucun transfert"
            message="Transfère du stock vers un apprenti avec le bouton « Nouveau »."
          />
        }
        renderItem={({ item }) => (
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2">
            <Text className="font-extrabold text-slate-900 dark:text-white">
              {item.produit?.designation ?? '—'} × {item.qte}
            </Text>
            <View className="flex-row items-center gap-1 mt-1">
              <Text className="text-[12px] text-slate-700 dark:text-slate-300">
                {item.source?.prenom} {item.source?.nom}
              </Text>
              <ArrowRight color="#10b981" size={12} />
              <Text className="text-[12px] text-slate-700 dark:text-slate-300">
                {item.destinataire?.prenom} {item.destinataire?.nom}
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400 mt-1">
              {formatDateShort(item.dateTransfert)}
              {item.commentaire ? ` · ${item.commentaire}` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
