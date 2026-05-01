import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { Building2, Users, ArrowRight, ChevronLeft, ChevronRight, History } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useReversementsSyntheseLivreur } from '../../../../features/reversements/hooks';
import { formatFCFA } from '../../../../lib/format';

/**
 * Synthèse Reversements (Item A) — affiche pour le mois sélectionné :
 *   - « Mes fournisseurs me doivent » (marge cumulée − dette courante)
 *   - « Je dois à mes clients » (marge due par client)
 *
 * Source : `GET /livreur/me/reversements-synthese?mois=YYYY-MM`.
 *
 * Tap sur une ligne → page de saisie d'un nouveau reversement avec le
 * bénéficiaire pré-sélectionné.
 */
export default function ReversementsSynthese() {
  const now = new Date();
  const [annee, setAnnee] = useState(now.getFullYear());
  const [mois, setMois] = useState(now.getMonth() + 1);

  const moisStr = `${annee}-${String(mois).padStart(2, '0')}`;
  const q = useReversementsSyntheseLivreur(moisStr);

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

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Reversements"
        subtitle={moisLabel}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/cash/reversements/historique' as never)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-70"
          >
            <History color="#64748b" size={14} />
            <Text className="text-slate-700 dark:text-slate-300 text-xs font-bold">
              Historique
            </Text>
          </Pressable>
        }
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
          {q.isLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : (
            <>
              {/* Mes fournisseurs me doivent */}
              <View className="flex-row items-center gap-2 mt-3 mb-2">
                <Building2 color="#3b82f6" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Mes fournisseurs me doivent
                </Text>
              </View>
              {(q.data?.mesFournisseursMeDoivent ?? []).length === 0 ? (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center mb-4">
                  <Text className="text-[12px] text-slate-400">
                    Aucune marge à recevoir ce mois-ci
                  </Text>
                </View>
              ) : (
                <View className="gap-2 mb-4">
                  {(q.data?.mesFournisseursMeDoivent ?? []).map((f) => (
                    <View
                      key={f.fournisseurId}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3"
                    >
                      <Text className="font-extrabold text-slate-900 dark:text-white">
                        {f.libelle}
                      </Text>
                      <View className="flex-row justify-between mt-2">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          Marge cumulée
                        </Text>
                        <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                          {formatFCFA(f.margeCumuleeMois)} F
                        </Text>
                      </View>
                      <View className="flex-row justify-between mt-1">
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          Dette courante
                        </Text>
                        <Text className="text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          − {formatFCFA(f.detteCourante)} F
                        </Text>
                      </View>
                      <View className="border-t border-slate-100 dark:border-slate-800 mt-2 pt-2 flex-row justify-between">
                        <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                          Net dû
                        </Text>
                        <Text
                          className={`font-extrabold ${
                            f.montantNetDu > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {formatFCFA(f.montantNetDu)} FCFA
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Je dois à mes clients */}
              <View className="flex-row items-center gap-2 mt-2 mb-2">
                <Users color="#8b5cf6" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Je dois à mes clients
                </Text>
              </View>
              {(q.data?.jeDoisAMesClients ?? []).length === 0 ? (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
                  <Text className="text-[12px] text-slate-400">
                    Aucun reversement à faire ce mois-ci
                  </Text>
                </View>
              ) : (
                <View className="gap-2">
                  {(q.data?.jeDoisAMesClients ?? []).map((c) => (
                    <Pressable
                      key={c.clientId}
                      onPress={() =>
                        router.push({
                          pathname: '/(livreur)/cash/reversements/nouveau' as never,
                          params: {
                            type: 'CLIENT',
                            beneficiaireId: c.clientId,
                            label: `${c.prenom} ${c.nom}`,
                            montantSuggere: String(c.margeDue),
                            mois,
                            annee,
                          },
                        } as never)
                      }
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex-row items-center justify-between active:opacity-70"
                    >
                      <View className="flex-1">
                        <Text className="font-extrabold text-slate-900 dark:text-white">
                          {c.prenom} {c.nom}
                        </Text>
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Marge due
                        </Text>
                      </View>
                      <View className="bg-violet-100 dark:bg-violet-500/15 px-2.5 py-1 rounded-full">
                        <Text className="text-[12px] font-extrabold text-violet-700 dark:text-violet-400">
                          {formatFCFA(c.margeDue)} F
                        </Text>
                      </View>
                      <ArrowRight color="#94a3b8" size={14} />
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
