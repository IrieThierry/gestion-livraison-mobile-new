import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Plus, Trash2, ListTree, Calendar } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import {
  usePrevisionsLivreur,
  useCumulLivreur,
  useSupprimerPrevision,
} from '../../../features/previsions/hooks';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Liste des prévisions pour une date donnée + cumul commande fournisseur.
 *
 * Vue principale du module Prévisions. Date par défaut = demain (J+1)
 * car c'est le cas d'usage typique (planifier la tournée du lendemain).
 */
export default function PrevisionsList() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [date, setDate] = useState<string | null>(tomorrow);

  const dateStr = date ?? tomorrow;
  const previsionsQ = usePrevisionsLivreur(livreurId, dateStr);
  const cumulQ = useCumulLivreur(livreurId, dateStr);
  const m = useSupprimerPrevision();

  const onDelete = (id: string, label: string) => {
    Alert.alert('Supprimer cette prévision ?', label, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => m.mutate(id) },
    ]);
  };

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Prévisions"
        subtitle="Planifier la tournée"
        right={
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(livreur)/previsions/nouvelle' as never,
                params: { date: dateStr },
              } as never)
            }
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={previsionsQ.isFetching && !previsionsQ.isLoading}
            onRefresh={() => {
              previsionsQ.refetch();
              cumulQ.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3 gap-3">
          {/* Date picker */}
          <DatePickerField
            label="Date de livraison"
            value={date}
            onChange={setDate}
          />

          {/* Cumul commande */}
          <View className="flex-row items-center gap-2 mt-2">
            <ListTree color="#3b82f6" size={14} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Cumul commande fournisseur
            </Text>
          </View>
          {(cumulQ.data ?? []).length === 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center">
                Aucune prévision saisie pour cette date.
              </Text>
            </View>
          ) : (
            <View className="bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-md p-3">
              {(cumulQ.data ?? []).map((c) => (
                <View
                  key={c.produit.id}
                  className="flex-row justify-between py-1"
                >
                  <Text className="text-[13px] text-blue-700 dark:text-blue-300">
                    {c.produit.designation}
                  </Text>
                  <Text className="text-[13px] font-bold text-blue-700 dark:text-blue-300">
                    {c.qteCumulee}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Détail par client */}
          <View className="flex-row items-center gap-2 mt-2">
            <Calendar color="#10b981" size={14} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Détail par client
            </Text>
          </View>
          {(previsionsQ.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucune prévision"
              message="Saisis tes prévisions du jour pour anticiper la commande fournisseur."
            />
          ) : (
            <View className="gap-2">
              {[...(previsionsQ.data ?? [])]
                .sort((a, b) => {
                  const cliCmp = `${a.client.prenom} ${a.client.nom}`.localeCompare(
                    `${b.client.prenom} ${b.client.nom}`,
                    'fr',
                  );
                  if (cliCmp !== 0) return cliCmp;
                  return (a.produit.designation ?? '').localeCompare(
                    b.produit.designation ?? '',
                    'fr',
                  );
                })
                .map((p) => (
                <View
                  key={p.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
                >
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      {p.client.prenom} {p.client.nom}
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {p.produit.designation}
                      {p.commentaire ? ` · ${p.commentaire}` : ''}
                    </Text>
                  </View>
                  <Text className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mr-2">
                    {p.qteEstimee}
                  </Text>
                  <Pressable
                    onPress={() =>
                      onDelete(
                        p.id,
                        `${p.client.prenom} — ${p.produit.designation} × ${p.qteEstimee}`,
                      )
                    }
                    hitSlop={6}
                    className="active:opacity-60 p-1"
                  >
                    <Trash2 color="#ef4444" size={14} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
