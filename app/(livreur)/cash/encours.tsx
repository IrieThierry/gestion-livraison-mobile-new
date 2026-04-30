import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { TrendingUp, ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { computeEncoursForClient, computeSoldeForClient } from '../../../lib/credit';
import { formatFCFA } from '../../../lib/format';

/**
 * Vue Encours — synthèse des créances clients du livreur connecté.
 *
 * On agrège côté front (mêmes formules que `lib/credit.ts`) parce que le
 * back ne propose pas (encore) un endpoint dédié. C'est cohérent avec ce
 * que la page web fait.
 */
export default function Encours() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const cliQ = useClientsByLivreur(livreurId);
  const livQ = useLivraisonsByLivreur(livreurId);
  const encQ = useEncaissementsByLivreur(livreurId);

  const lignes = useMemo(() => {
    const clients = cliQ.data ?? [];
    const livraisons = livQ.data ?? [];
    const encaissements = encQ.data ?? [];
    return clients
      .map((c) => ({
        client: c,
        encours: computeEncoursForClient(livraisons, c.id),
        solde: computeSoldeForClient(livraisons, encaissements, c.id),
      }))
      .filter((l) => l.encours > 0 || l.solde > 0)
      .sort((a, b) => b.solde - a.solde);
  }, [cliQ.data, livQ.data, encQ.data]);

  const totals = useMemo(() => {
    const totalEncours = lignes.reduce((acc, l) => acc + l.encours, 0);
    const totalSolde = lignes.reduce(
      (acc, l) => acc + Math.max(0, l.solde),
      0,
    );
    return { totalEncours, totalSolde };
  }, [lignes]);

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Encours clients"
        subtitle={`${lignes.length} client${lignes.length > 1 ? 's' : ''} avec créance`}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={cliQ.isFetching && !cliQ.isLoading}
            onRefresh={() => {
              cliQ.refetch();
              livQ.refetch();
              encQ.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Totaux */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-amber-500 rounded-lg p-4 shadow-md">
              <Text className="text-[10px] font-semibold uppercase text-white/90">
                Total dû
              </Text>
              <Text className="text-2xl font-extrabold text-white mt-1">
                {formatFCFA(totals.totalSolde)}
              </Text>
              <Text className="text-[10px] text-white/85 mt-1">FCFA · solde positif</Text>
            </View>
            <View className="flex-1 bg-emerald-500 rounded-lg p-4 shadow-md">
              <Text className="text-[10px] font-semibold uppercase text-white/90">
                Encours
              </Text>
              <Text className="text-2xl font-extrabold text-white mt-1">
                {formatFCFA(totals.totalEncours)}
              </Text>
              <Text className="text-[10px] text-white/85 mt-1">FCFA · livré non encaissé</Text>
            </View>
          </View>

          {/* Liste */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Détail par client
          </Text>

          {lignes.length === 0 ? (
            <EmptyState
              title="Aucun client en créance"
              message="Toutes tes livraisons sont à jour."
            />
          ) : (
            <View className="gap-2">
              {lignes.map((l) => (
                <Pressable
                  key={l.client.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(livreur)/clients/[id]' as never,
                      params: { id: l.client.id },
                    } as never)
                  }
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center gap-2 active:opacity-70"
                >
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      {l.client.prenom} {l.client.nom}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Encours : {formatFCFA(l.encours)} FCFA
                    </Text>
                  </View>
                  <View className="items-end">
                    <View className="bg-amber-100 dark:bg-amber-500/15 px-2 py-1 rounded-full">
                      <Text className="text-[12px] font-extrabold text-amber-800 dark:text-amber-400">
                        {formatFCFA(l.solde)} F
                      </Text>
                    </View>
                    <Text className="text-[9px] text-slate-400 mt-1">SOLDE</Text>
                  </View>
                  <ArrowRight color="#94a3b8" size={14} />
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
