import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { ListFilter } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { useClientsByLivreur } from '../../../../features/clients/hooks';
import { useEncaissementsByLivreur } from '../../../../features/encaissements/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { formatFCFA, formatDateShort } from '../../../../lib/format';

type Periode = '7j' | '30j' | '90j' | 'all';

const PERIODES: Array<{ key: Periode; label: string; days: number | null }> = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
  { key: 'all', label: 'Tout', days: null },
];

/**
 * Sous-page « Tous les encaissements d'un client » — accessible depuis
 * la fiche client. Liste filtrable par période. Sortie de la fiche
 * principale qui devenait trop chargée.
 */
export default function EncaissementsClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qC = useClientsByLivreur(livreurId);
  const qE = useEncaissementsByLivreur(livreurId);

  const [periode, setPeriode] = useState<Periode>('30j');

  const client = useMemo(
    () => (qC.data ?? []).find((c) => c.id === id),
    [qC.data, id],
  );

  const encaissements = useMemo(
    () =>
      (qE.data ?? [])
        .filter((e) => e.client?.id === id)
        .sort((a, b) => {
          const da = a.date ? new Date(a.date).getTime() : 0;
          const db = b.date ? new Date(b.date).getTime() : 0;
          return db - da;
        }),
    [qE.data, id],
  );

  const filtres = useMemo(() => {
    const now = Date.now();
    const days = PERIODES.find((p) => p.key === periode)?.days ?? null;
    return encaissements.filter((e) => {
      if (days !== null && e.date) {
        return now - new Date(e.date).getTime() <= days * 86_400_000;
      }
      return true;
    });
  }, [encaissements, periode]);

  const total = filtres.reduce((acc, e) => acc + (e.montantEncaisse ?? 0), 0);

  const fullName = client ? `${client.prenom} ${client.nom}`.trim() : 'Client';

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Encaissements" subtitle={fullName} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qE.isFetching && !qE.isLoading}
            onRefresh={() => qE.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Filtre période */}
          <View className="flex-row items-center gap-1.5 mb-2">
            <ListFilter color="#64748b" size={12} />
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
              Période
            </Text>
          </View>
          <View className="flex-row gap-2 mb-3">
            {PERIODES.map((p) => (
              <FilterChip
                key={p.key}
                active={periode === p.key}
                label={p.label}
                onPress={() => setPeriode(p.key)}
              />
            ))}
          </View>

          {/* Récap */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mb-3 flex-row justify-between items-center">
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">
              {filtres.length} encaissement{filtres.length > 1 ? 's' : ''}
            </Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(total)} F
            </Text>
          </View>

          {filtres.length === 0 ? (
            <EmptyState
              title="Aucun encaissement"
              message="Aucun encaissement ne correspond à la période choisie."
            />
          ) : (
            <View className="gap-2">
              {filtres.map((e) => (
                <View
                  key={e.reference}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-md p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-[12px] text-slate-700 dark:text-slate-300 font-bold">
                      {e.date ? formatDateShort(e.date) : '—'}
                    </Text>
                    {e.commentaire ? (
                      <Text className="text-[10px] text-slate-400 mt-0.5">
                        {e.commentaire}
                      </Text>
                    ) : null}
                  </View>
                  <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    +{formatFCFA(e.montantEncaisse)} F
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-3 py-1.5 rounded-md border ${
        active
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
      }`}
    >
      <Text
        className={`text-[12px] font-bold ${
          active ? 'text-white' : 'text-slate-700 dark:text-slate-300'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
