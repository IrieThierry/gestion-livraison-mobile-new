import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { LivraisonCard } from '../../../components/livreur/LivraisonCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { PageHeader } from '../../../components/shared/PageHeader';
import type { StatutLivraison } from '../../../types/api';

type Period = 'today' | 'week' | 'month' | 'all';
type StatutFilter = 'ALL' | StatutLivraison;

function isInPeriod(d: Date, p: Period): boolean {
  const now = new Date();
  if (p === 'today') return d.toDateString() === now.toDateString();
  if (p === 'all') return true;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (p === 'week') start.setDate(now.getDate() - 7);
  else if (p === 'month') start.setMonth(now.getMonth() - 1);
  return d >= start;
}

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Aujourd’hui',
  week: '7 j',
  month: '30 j',
  all: 'Tous',
};

const STATUT_LABELS: Record<StatutFilter, string> = {
  ALL: 'Tous statuts',
  LIVREE: 'Livrées',
  ENCAISSEE: 'Encaissées',
};

export default function LivraisonsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);

  const [period, setPeriod] = useState<Period>('today');
  const [statut, setStatut] = useState<StatutFilter>('ALL');

  const filtered = useMemo(() => {
    return (q.data ?? [])
      .filter((l) => isInPeriod(new Date(l.date), period))
      .filter((l) => statut === 'ALL' || l.statut === statut);
  }, [q.data, period, statut]);

  if (!user) return null;

  const Pill = ({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-md ${
        active
          ? 'bg-emerald-500'
          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`text-[11px] font-bold ${
          active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Livraisons"
        subtitle={`${filtered.length} résultat${filtered.length > 1 ? 's' : ''}`}
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        {/* Period pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="mb-2"
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <Pill
              key={p}
              active={period === p}
              label={PERIOD_LABELS[p]}
              onPress={() => setPeriod(p)}
            />
          ))}
        </ScrollView>

        {/* Statut pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          className="mb-3"
        >
          {(Object.keys(STATUT_LABELS) as StatutFilter[]).map((s) => (
            <Pill
              key={s}
              active={statut === s}
              label={STATUT_LABELS[s]}
              onPress={() => setStatut(s)}
            />
          ))}
        </ScrollView>

        {/* List */}
        <View className="px-4 gap-2">
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucune livraison"
              message="Ajuste les filtres ou crée une livraison via le bouton ➕."
            />
          ) : (
            filtered.map((l) => <LivraisonCard key={l.id} livraison={l} />)
          )}
        </View>
      </ScrollView>
    </View>
  );
}
