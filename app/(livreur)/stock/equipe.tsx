import { useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useStockActuelParent } from '../../../features/stock/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';

/**
 * « Stock équipe » — vue agrégée du stock embarqué root + apprentis.
 * Source : `GET /stock-livreur/parent/{parentId}/actuel`. Réservé aux
 * livreurs racines.
 */
export default function StockEquipe() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useStockActuelParent(livreurId);

  // Regroupe par livreur pour afficher des sections
  const groups = useMemo(() => {
    const map = new Map<string, { livreur: { id: string; prenom: string; nom: string }; lignes: typeof q.data }>();
    for (const ligne of q.data ?? []) {
      const key = ligne.livreur?.id ?? '—';
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          livreur: ligne.livreur ?? { id: '—', prenom: '?', nom: '' },
          lignes: [ligne],
        });
      } else {
        (existing.lignes ??= []).push(ligne);
      }
    }
    return Array.from(map.values());
  }, [q.data]);

  const totalUnites = useMemo(
    () => (q.data ?? []).reduce((acc, l) => acc + (l.qte ?? 0), 0),
    [q.data],
  );

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Stock équipe"
        subtitle={`${groups.length} livreur${groups.length > 1 ? 's' : ''} · ${totalUnites} unités`}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Carte hero */}
          <View className="bg-emerald-500 rounded-lg p-4 shadow-md">
            <Text className="text-[10px] font-semibold uppercase text-white/90">
              Total embarqué (root + apprentis)
            </Text>
            <Text className="text-3xl font-extrabold text-white mt-1">
              {totalUnites} <Text className="text-sm">unités</Text>
            </Text>
          </View>

          {/* Liste par livreur */}
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm mt-5">Chargement…</Text>
          ) : groups.length === 0 ? (
            <View className="mt-5">
              <EmptyState
                title="Stock équipe vide"
                message="Aucun membre de l'équipe n'a de stock embarqué actuellement."
              />
            </View>
          ) : (
            <View className="mt-5 gap-3">
              {groups.map((g) => {
                const livName = `${g.livreur.prenom} ${g.livreur.nom}`.trim();
                const isSelf = g.livreur.id === user.id;
                const totalGroup = (g.lignes ?? []).reduce(
                  (acc, l) => acc + (l.qte ?? 0),
                  0,
                );
                return (
                  <View key={g.livreur.id}>
                    <View className="flex-row items-center justify-between mb-2">
                      <Text className="text-[12px] uppercase tracking-wide font-bold text-slate-700 dark:text-slate-300">
                        {isSelf ? `${livName} (toi)` : livName}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        {totalGroup} unités
                      </Text>
                    </View>
                    <View className="gap-2">
                      {(g.lignes ?? []).map((l) => (
                        <View
                          key={l.id}
                          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center justify-between"
                        >
                          <View className="flex-1 pr-2">
                            <Text className="font-bold text-slate-900 dark:text-white text-[13px]">
                              {l.produit?.designation ?? '—'}
                            </Text>
                            <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {l.fournisseur?.libelle ?? '—'}
                              {l.coutTotal ? ` · ${formatFCFA(l.coutTotal)} FCFA` : ''}
                            </Text>
                          </View>
                          <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                            {l.qte}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
