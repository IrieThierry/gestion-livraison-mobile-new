import { useMemo } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import { livraisonKeys } from '../../features/livraisons/keys';
import { useAuthStore } from '../../stores/authStore';
import { StatCard } from '../../components/shared/StatCard';
import { EmptyState } from '../../components/shared/EmptyState';
import { FreshnessIndicator } from '../../components/shared/FreshnessIndicator';
import { LivraisonCard } from '../../components/livreur/LivraisonCard';
import { formatFCFA } from '../../lib/format';

export default function Tournee() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);

  const { duJour, totalEncaisse, aEncaisser } = useMemo(() => {
    const all = q.data ?? [];
    const today = new Date().toDateString();
    const duJour = all.filter((l) => new Date(l.date).toDateString() === today);
    const totalEncaisse = duJour
      .filter((l) => l.statut === 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    const aEncaisser = duJour
      .filter((l) => l.statut !== 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    return { duJour, totalEncaisse, aEncaisser };
  }, [q.data]);

  if (!user) return null;

  return (
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={q.isFetching && !q.isLoading}
          onRefresh={() => q.refetch()}
          tintColor="#10b981"
        />
      }
    >
      <View className="px-4 pt-3">
        {/* Greeting + freshness */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400">Bonjour</Text>
            <Text className="font-extrabold text-slate-900 dark:text-white text-base">
              {user.prenom} {user.nom?.[0] ?? ''}.
            </Text>
          </View>
          <FreshnessIndicator queryKey={livraisonKeys.byLivreur(livreurId)} />
        </View>

        {/* Hero — solde du jour */}
        <View className="bg-emerald-500 mt-4 rounded-lg p-4 shadow-md">
          <Text className="text-[10px] font-semibold uppercase tracking-wide text-white/90">
            Solde du jour
          </Text>
          <Text className="text-3xl font-extrabold text-white mt-1">
            {formatFCFA(totalEncaisse)} <Text className="text-sm">FCFA</Text>
          </Text>
          <Text className="text-xs text-white/90 mt-2">
            {duJour.length} livraison{duJour.length > 1 ? 's' : ''} · {formatFCFA(aEncaisser)} à encaisser
          </Text>
        </View>

        {/* StatCards */}
        <View className="flex-row gap-2 mt-3">
          <View className="flex-1">
            <StatCard label="Livraisons" value={duJour.length} accent="emerald" />
          </View>
          <View className="flex-1">
            <StatCard label="À encaisser" value={formatFCFA(aEncaisser)} accent="amber" />
          </View>
        </View>

        {/* List */}
        <Text className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-5 mb-2">
          Ma tournée · aujourd'hui
        </Text>

        {q.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : duJour.length === 0 ? (
          <EmptyState
            title="Aucune livraison"
            message="Crée ta première livraison via le bouton ➕."
          />
        ) : (
          <View className="gap-2">
            {duJour.map((l) => (
              <LivraisonCard key={l.id} livraison={l} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}
