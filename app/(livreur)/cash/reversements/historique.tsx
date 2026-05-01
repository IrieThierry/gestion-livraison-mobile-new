import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  History,
} from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useReversementsListe } from '../../../../features/reversements/hooks';
import { formatFCFA, formatDateShort } from '../../../../lib/format';

/**
 * « Mes reversements » — historique des reversements enregistrés.
 *
 * Affiche pour le mois sélectionné la liste de tous les reversements
 * faits par le livreur (vers ses clients ou ses fournisseurs). Source :
 * `GET /reversement?annee=X&mois=Y`.
 *
 * Navigation depuis : Cash → Reversements → bouton « Historique » sur
 * la page synthèse.
 */
export default function ReversementsHistorique() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);

  const q = useReversementsListe(annee, mois);

  const moisLabel = useMemo(() => {
    const date = new Date(annee, mois - 1, 1);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }, [annee, mois]);

  const onPrevMonth = () => {
    if (mois === 1) {
      setMois(12);
      setAnnee(annee - 1);
    } else {
      setMois(mois - 1);
    }
  };
  const onNextMonth = () => {
    if (mois === 12) {
      setMois(1);
      setAnnee(annee + 1);
    } else {
      setMois(mois + 1);
    }
  };

  // Tri stable : plus récent en premier
  const reversements = useMemo(
    () =>
      [...(q.data ?? [])].sort(
        (a, b) =>
          new Date(b.dateReversement).getTime() -
          new Date(a.dateReversement).getTime(),
      ),
    [q.data],
  );

  const totalMois = reversements.reduce(
    (acc, r) => acc + (r.montant ?? 0),
    0,
  );
  const totalClients = reversements
    .filter((r) => r.type === 'CLIENT')
    .reduce((acc, r) => acc + (r.montant ?? 0), 0);
  const totalFournisseurs = reversements
    .filter((r) => r.type === 'FOURNISSEUR')
    .reduce((acc, r) => acc + (r.montant ?? 0), 0);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Mes reversements" subtitle={moisLabel} />

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
        {/* Sélecteur mois */}
        <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
          <Pressable
            onPress={onPrevMonth}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 active:opacity-70"
          >
            <ChevronLeft color="#64748b" size={18} />
          </Pressable>
          <Text className="font-extrabold text-slate-900 dark:text-white capitalize">
            {moisLabel}
          </Text>
          <Pressable
            onPress={onNextMonth}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-2 active:opacity-70"
          >
            <ChevronRight color="#64748b" size={18} />
          </Pressable>
        </View>

        <View className="px-4">
          {/* KPIs du mois */}
          <View className="bg-emerald-500 rounded-lg p-4 shadow-md">
            <Text className="text-[10px] font-semibold uppercase text-white/90">
              Total reversé ce mois
            </Text>
            <Text className="text-3xl font-extrabold text-white mt-1">
              {formatFCFA(totalMois)} <Text className="text-base">FCFA</Text>
            </Text>
            <Text className="text-[11px] text-white/85 mt-1">
              {reversements.length} reversement{reversements.length > 1 ? 's' : ''}
            </Text>
          </View>

          <View className="flex-row gap-2 mt-3">
            <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <View className="flex-row items-center gap-1.5">
                <Users color="#8b5cf6" size={11} />
                <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                  Clients
                </Text>
              </View>
              <Text className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {formatFCFA(totalClients)} F
              </Text>
            </View>
            <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <View className="flex-row items-center gap-1.5">
                <Building2 color="#3b82f6" size={11} />
                <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                  Fournisseurs
                </Text>
              </View>
              <Text className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {formatFCFA(totalFournisseurs)} F
              </Text>
            </View>
          </View>

          {/* Liste */}
          <View className="flex-row items-center gap-1.5 mt-5 mb-2">
            <History color="#64748b" size={12} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Historique
            </Text>
          </View>

          {q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : reversements.length === 0 ? (
            <EmptyState
              title="Aucun reversement ce mois"
              message="Tu n'as fait aucun reversement sur cette période."
            />
          ) : (
            <View className="gap-2">
              {reversements.map((r) => {
                const isClient = r.type === 'CLIENT';
                const Icon = isClient ? Users : Building2;
                const color = isClient ? '#8b5cf6' : '#3b82f6';
                const bg = isClient
                  ? 'bg-violet-100 dark:bg-violet-500/15'
                  : 'bg-blue-100 dark:bg-blue-500/15';
                const borderClass = isClient
                  ? 'border-l-violet-500'
                  : 'border-l-blue-500';
                return (
                  <View
                    key={r.id}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${borderClass} rounded-md p-3 flex-row items-center gap-3`}
                  >
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${bg}`}>
                      <Icon color={color} size={16} />
                    </View>
                    <View className="flex-1">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {isClient ? 'Reversement client' : 'Reversement fournisseur'}
                      </Text>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDateShort(r.dateReversement)}
                        {r.commentaire ? ` · ${r.commentaire}` : ''}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text
                        className="font-extrabold text-base"
                        style={{ color }}
                      >
                        {formatFCFA(r.montant)}
                      </Text>
                      <Text className="text-[9px] text-slate-400 dark:text-slate-500">
                        FCFA
                      </Text>
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
