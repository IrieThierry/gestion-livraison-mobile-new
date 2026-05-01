import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { Search, X, ChevronLeft } from 'lucide-react-native';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { LivraisonCard, deriveStatus } from '../../../components/livreur/LivraisonCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { formatFCFA } from '../../../lib/format';
import type { LivraisonResponse } from '../../../types/api';

type Period = 'today' | 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Semaine',
  month: 'Mois',
  all: 'Tous',
};

function inPeriod(d: Date, p: Period): boolean {
  const now = new Date();
  if (p === 'today') return d.toDateString() === now.toDateString();
  if (p === 'all') return true;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (p === 'week') start.setDate(now.getDate() - 7);
  else if (p === 'month') start.setMonth(now.getMonth() - 1);
  return d >= start;
}

export default function LivraisonsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);
  const [period, setPeriod] = useState<Period>('today');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo<LivraisonResponse[]>(() => {
    let list = (q.data ?? []).filter((l) => inPeriod(new Date(l.date), period));
    if (search.trim()) {
      const needle = search.toLowerCase();
      list = list.filter(
        (l) =>
          `${l.client.prenom} ${l.client.nom}`.toLowerCase().includes(needle) ||
          (l.client.quartier?.libelle ?? '').toLowerCase().includes(needle),
      );
    }
    // Tri stable : plus récent en premier (date desc)
    return [...list].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [q.data, period, search]);

  const stats = useMemo(() => {
    let encaissees = 0;
    let livrees = 0;
    let impayees = 0;
    let totalEncaisse = 0;
    let marge = 0;
    for (const l of filtered) {
      const ds = deriveStatus(l);
      if (ds === 'ENCAISSEE') {
        encaissees += 1;
        totalEncaisse += l.montantLivre ?? 0;
      } else if (ds === 'LIVREE') {
        livrees += 1;
      } else {
        impayees += 1;
      }
      // Plan D — marge cristallisée par ligne : Σ qte × margeUnitaire (toutes
      // livraisons, car la marge est acquise dès la livraison).
      for (const p of l.produitsLivraison ?? []) {
        const qte = (p.qteLivre ?? 0) - (p.qteRetourne ?? 0);
        marge += (Number(p.margeUnitaire) || 0) * qte;
      }
    }
    return { encaissees, livrees, impayees, totalEncaisse, marge };
  }, [filtered]);

  if (!user) return null;

  const subtitle = `${filtered.length} livraison${filtered.length > 1 ? 's' : ''}${
    period === 'today' ? " aujourd'hui" : ''
  }`;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-3 pb-2 gap-3">
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.push('/(livreur)' as never);
          }}
          hitSlop={8}
          className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          <ChevronLeft color="#475569" size={20} />
        </Pressable>
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white text-lg">Livraisons</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</Text>
        </View>
        <Pressable
          onPress={() => setSearchOpen((v) => !v)}
          hitSlop={8}
          className="w-10 h-10 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
        >
          {searchOpen ? <X color="#475569" size={18} /> : <Search color="#475569" size={18} />}
        </Pressable>
      </View>

      {searchOpen ? (
        <View className="px-4 pb-2">
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher un client ou quartier…"
            placeholderTextColor="#94a3b8"
            autoFocus
            autoCorrect={false}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md px-3 py-2.5 text-slate-900 dark:text-white text-base"
          />
        </View>
      ) : null}

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
        <View className="px-4">
          {/* 3 stat cards */}
          <View className="flex-row gap-2 mt-1">
            <StatCount label="Encaissée" value={stats.encaissees} accent="emerald" />
            <StatCount label="Livrée" value={stats.livrees} accent="amber" />
            <StatCount label="Impayée" value={stats.impayees} accent="red" />
          </View>

          {/* Total encaissé + Marge banner */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mt-2 flex-row">
            <View className="flex-1">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Total encaissé
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white mt-0.5">
                <Text className="text-xl">{formatFCFA(stats.totalEncaisse)}</Text>
                <Text className="text-xs text-slate-500 dark:text-slate-400"> FCFA</Text>
              </Text>
            </View>
            <View className="items-end">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Marge
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xl mt-0.5">
                + {formatFCFA(stats.marge)}
              </Text>
            </View>
          </View>

          {/* Period pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ gap: 8, paddingTop: 4, paddingBottom: 4 }}
            className="mt-3"
          >
            {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                className={`px-4 py-2 rounded-md ${
                  period === p
                    ? 'bg-emerald-500'
                    : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                }`}
              >
                <Text
                  className={`text-[12px] font-bold ${
                    period === p ? 'text-white' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Section title */}
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mt-4 mb-2">
            Ma tournée
          </Text>

          {/* List */}
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="Aucune livraison"
              message={
                search
                  ? 'Aucun résultat pour cette recherche.'
                  : 'Ajuste les filtres ou crée une livraison via le bouton ➕.'
              }
            />
          ) : (
            <View className="gap-2">
              {filtered.map((l) => (
                <LivraisonCard key={l.id} livraison={l} />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function StatCount({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'emerald' | 'amber' | 'red';
}) {
  const border =
    accent === 'emerald'
      ? 'border-l-emerald-500'
      : accent === 'amber'
        ? 'border-l-amber-500'
        : 'border-l-red-500';
  return (
    <View
      className={`flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${border} rounded-lg p-2.5`}
    >
      <Text className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-extrabold">
        {label}
      </Text>
      <Text className="text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
        {value}
      </Text>
    </View>
  );
}
