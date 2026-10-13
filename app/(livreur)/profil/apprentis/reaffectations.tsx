import { useState } from 'react';
import { ScrollView, View, Text, RefreshControl, ActivityIndicator } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { FiltrePeriode } from '../../../../components/shared/FiltrePeriode';
import { useAuthStore } from '../../../../stores/authStore';
import { useReaffectations } from '../../../../features/equipe/hooks';
import { nomComplet, peutReaffecter } from '../../../../features/equipe/regles';
import { PERIODES_JOURS as PERIODES, bornesPeriode, type RaccourciJours as Raccourci, type ValeurPeriode } from '../../../../lib/periode';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatDateShort, formatTime } from '../../../../lib/format';

/**
 * Historique des réaffectations de l'équipe (P8) : qui a déplacé quel client,
 * de quel livreur vers lequel, plus récentes d'abord. Période (Aujourd'hui,
 * 7 j, 30 j par défaut, Période…) envoyée à la route (`debut` / `fin`).
 */
export default function HistoriqueReaffectations() {
  const user = useAuthStore((s) => s.user);
  const [periode, setPeriode] = useState<ValeurPeriode<Raccourci>>({ cle: '30j' });
  const { debut, fin } = bornesPeriode(periode, PERIODES);
  const q = useReaffectations({ debut, fin });

  if (!user) return null;

  if (!peutReaffecter(user)) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Réaffectations" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal indépendant consulte les réaffectations de son équipe."
        />
      </View>
    );
  }

  const lignes = q.data ?? [];
  const moi = (id: string | null) => (id === user.id ? 'Moi' : null);

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Réaffectations"
        subtitle={`${lignes.length} déplacement${lignes.length > 1 ? 's' : ''}`}
      />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#10b981" />
        }
      >
        <View className="px-4 pt-3">
          <View className="mb-3">
            <FiltrePeriode options={PERIODES} valeur={periode} defaut="30j" onChange={setPeriode} titre={null} />
          </View>

          {q.isLoading ? (
            <ActivityIndicator color="#10b981" />
          ) : q.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(q.error, 'Impossible de charger les réaffectations.')}
            />
          ) : lignes.length === 0 ? (
            <EmptyState title="Aucune réaffectation" message="Aucun client n’a été déplacé sur cette période." />
          ) : (
            <View className="gap-2">
              {lignes.map((r) => (
                <View
                  key={r.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-violet-500 rounded-lg p-3"
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="font-extrabold text-slate-900 dark:text-white text-[13px] flex-1 pr-2">
                      {nomComplet(r.clientPrenom, r.clientNom) || 'Client'}
                    </Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatDateShort(r.date)} · {formatTime(r.date)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5 mt-1">
                    <Text className="text-[12px] text-slate-600 dark:text-slate-300">
                      {moi(r.ancienCommercialId) ?? (nomComplet(r.ancienCommercialPrenom, r.ancienCommercialNom) || '—')}
                    </Text>
                    <ArrowRight color="#8b5cf6" size={12} />
                    <Text className="text-[12px] font-bold text-slate-900 dark:text-white">
                      {moi(r.nouveauCommercialId) ?? (nomComplet(r.nouveauCommercialPrenom, r.nouveauCommercialNom) || '—')}
                    </Text>
                  </View>
                  {r.parId ? (
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                      Par {moi(r.parId) ?? nomComplet(r.parPrenom, r.parNom)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
