import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useEncoursByLivreur } from '../../../features/clients/hooks';
import {
  num,
  totalAEncaisser,
  totalAvances,
} from '../../../features/encaissements/regles';
import { libelleLimiteCredit } from '../../../features/clients/regles';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { useAuthStore } from '../../../stores/authStore';
import { formatMontant } from '../../../lib/format';

/**
 * Vue Encours — soldes clients du livreur connecté, calculés par le
 * serveur (`GET /client/encours/livreur/{id}`) : dû net (remises et
 * retours compris) moins paiements. Solde négatif = avance du client.
 * La limite de crédit et le dépassement sont ceux du serveur.
 */
export default function Encours() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useEncoursByLivreur(livreurId);

  const lignes = useMemo(
    () =>
      (q.data ?? [])
        .filter((e) => num(e.solde) !== 0)
        .sort((a, b) => num(b.solde) - num(a.solde)),
    [q.data],
  );
  const totalDu = totalAEncaisser(q.data ?? []);
  const avances = totalAvances(q.data ?? []);
  const nbDepassement = (q.data ?? []).filter((e) => e.enDepassement).length;

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Encours clients"
        subtitle={`${lignes.length} client${lignes.length > 1 ? 's' : ''} avec un solde`}
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
          <View className="flex-row gap-2">
            <View className="flex-1 bg-amber-500 rounded-lg p-4 shadow-md">
              <Text className="text-[10px] font-semibold uppercase text-white/90">À encaisser</Text>
              <Text className="text-2xl font-extrabold text-white mt-1">
                {formatMontant(totalDu)}
              </Text>
              <Text className="text-[10px] text-white/85 mt-1">FCFA · soldes dus</Text>
            </View>
            <View className="flex-1 bg-emerald-500 rounded-lg p-4 shadow-md">
              <Text className="text-[10px] font-semibold uppercase text-white/90">Avances</Text>
              <Text className="text-2xl font-extrabold text-white mt-1">
                {formatMontant(avances)}
              </Text>
              <Text className="text-[10px] text-white/85 mt-1">FCFA · payées d'avance</Text>
            </View>
          </View>
          {nbDepassement > 0 ? (
            <Text className="text-[12px] font-bold text-red-600 dark:text-red-400 mt-3">
              {nbDepassement} client{nbDepassement > 1 ? 's' : ''} au-delà de la limite de crédit
            </Text>
          ) : null}

          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Détail par client
          </Text>

          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : q.isError ? (
            <EmptyState
              title="Encours indisponibles"
              message={extractApiErrorMessage(q.error, 'Réessaye plus tard.')}
            />
          ) : lignes.length === 0 ? (
            <EmptyState title="Aucun solde en cours" message="Tous tes clients sont à jour." />
          ) : (
            <View className="gap-2">
              {lignes.map((e) => {
                const solde = num(e.solde);
                const avance = solde < 0;
                return (
                  <Pressable
                    key={e.clientId}
                    onPress={() =>
                      router.push({
                        pathname: '/(livreur)/clients/[id]' as never,
                        params: { id: e.clientId },
                      } as never)
                    }
                    className={`bg-white dark:bg-slate-900 border rounded-lg p-3 flex-row items-center gap-2 active:opacity-70 ${
                      e.enDepassement
                        ? 'border-red-300 dark:border-red-500/40'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <View className="flex-1">
                      <Text className="font-extrabold text-slate-900 dark:text-white">
                        {e.nomClient}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {`Limite : ${libelleLimiteCredit(num(e.limiteCredit))}`}
                        {e.enDepassement ? ' · dépassée' : ''}
                      </Text>
                    </View>
                    <View className="items-end">
                      <View
                        className={`px-2 py-1 rounded-full ${
                          avance
                            ? 'bg-emerald-100 dark:bg-emerald-500/15'
                            : 'bg-amber-100 dark:bg-amber-500/15'
                        }`}
                      >
                        <Text
                          className={`text-[12px] font-extrabold ${
                            avance
                              ? 'text-emerald-800 dark:text-emerald-400'
                              : 'text-amber-800 dark:text-amber-400'
                          }`}
                        >
                          {formatMontant(Math.abs(solde))} F
                        </Text>
                      </View>
                      <Text className="text-[9px] text-slate-400 mt-1">
                        {avance ? 'AVANCE' : 'DÛ'}
                      </Text>
                    </View>
                    <ArrowRight color="#94a3b8" size={14} />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
