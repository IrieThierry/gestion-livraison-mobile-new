import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Plus, CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useCloturesByLivreur } from '../../../features/clotures/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA, formatDateShort } from '../../../lib/format';

/**
 * Liste des clôtures journalières du livreur connecté. Source :
 * `GET /cloture-journaliere/livreur/{livreurId}`. Tap sur le bouton
 * « Nouvelle » pour clôturer la journée en cours.
 */
export default function CloturesList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useCloturesByLivreur(livreurId);

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Clôtures journalières"
        subtitle={`${q.data?.length ?? 0} clôture${(q.data?.length ?? 0) > 1 ? 's' : ''}`}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/clotures/nouvelle' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      <FlatList
        data={[...(q.data ?? [])].sort(
          (a, b) =>
            new Date(b.dateCloture).getTime() -
            new Date(a.dateCloture).getTime(),
        )}
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
          <EmptyState
            title="Aucune clôture"
            message="Clôture ta journée en fin de tournée pour fixer le récap CA / encaissé / écart caisse."
          />
        }
        renderItem={({ item }) => {
          const ecart = item.ecartEspeces ?? 0;
          const balanced = ecart === 0;
          return (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {formatDateShort(item.dateCloture)}
                </Text>
                {balanced ? (
                  <View className="flex-row items-center gap-1 bg-emerald-100 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full">
                    <CheckCircle2 color="#059669" size={11} />
                    <Text className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                      Équilibrée
                    </Text>
                  </View>
                ) : (
                  <View className="flex-row items-center gap-1 bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 rounded-full">
                    <AlertTriangle color="#d97706" size={11} />
                    <Text className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
                      Écart {ecart > 0 ? '+' : ''}{formatFCFA(ecart)}
                    </Text>
                  </View>
                )}
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total livré
                </Text>
                <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {formatFCFA(item.totalLivre)} F
                </Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  Total encaissé
                </Text>
                <Text className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                  {formatFCFA(item.totalEncaisse)} F
                </Text>
              </View>
              <View className="flex-row justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                  Montant remis
                </Text>
                <Text className="font-extrabold text-slate-900 dark:text-white">
                  {formatFCFA(item.montantRemis)} F
                </Text>
              </View>
              {item.commentaire ? (
                <Text className="text-[10px] text-slate-400 mt-2 italic">
                  {item.commentaire}
                </Text>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}
