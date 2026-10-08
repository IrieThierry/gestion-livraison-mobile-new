import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  RotateCcw,
  ListFilter,
  User,
  Package,
  ArrowRight,
  X,
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SelectField } from '../../../components/shared/SelectField';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useRetours } from '../../../features/retours/hooks';
import { derniersJours, moisEnCours } from '../../../features/retours/api';
import {
  libelleDestination,
  libelleOrigine,
  libelleQuantite,
  libelleValeur,
} from '../../../features/retours/libelles';
import { useAuthStore } from '../../../stores/authStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort } from '../../../lib/format';

type Periode = 'mois' | '30j' | '90j' | 'all';

const PERIODES: Array<{ key: Periode; label: string }> = [
  { key: 'mois', label: 'Ce mois' },
  { key: '30j', label: '30 jours' },
  { key: '90j', label: '90 jours' },
  { key: 'all', label: 'Tout' },
];

function bornes(periode: Periode): { debut?: string; fin?: string } {
  switch (periode) {
    case 'mois':
      return moisEnCours();
    case '30j':
      return derniersJours(30);
    case '90j':
      return derniersJours(90);
    default:
      return {};
  }
}

/**
 * Journal des retours client (`GET /retour`, trié du plus récent au plus
 * ancien par le serveur, paginé).
 *
 * Filtres :
 *   - Période (mois en cours par défaut, 30 / 90 jours, tout)
 *   - Client (dropdown, optionnel) — pré-rempli avec `?clientId=X`
 *
 * Pas de totaux : une correction (quantité négative) s'affiche « Correction −n ».
 */
export default function RetoursList() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const qCli = useClientsByLivreur(livreurId);

  const [periode, setPeriode] = useState<Periode>('mois');
  const [clientFilter, setClientFilter] = useState<string | null>(
    params.clientId ?? null,
  );

  const filtres = useMemo(
    () => ({ ...bornes(periode), ...(clientFilter ? { clientId: clientFilter } : {}) }),
    [periode, clientFilter],
  );
  const q = useRetours(filtres);
  const retours = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.contenu), [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;

  const clientOptions = useMemo(
    () =>
      [...(qCli.data ?? [])]
        .sort((a, b) =>
          `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'),
        )
        .map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}`.trim() })),
    [qCli.data],
  );

  const clientLabel = clientFilter
    ? clientOptions.find((c) => c.id === clientFilter)?.label ?? 'Client'
    : null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Retours"
        subtitle={clientLabel ?? 'Tous clients'}
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/cash/retour-client' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <RotateCcw color="#fff" size={13} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Filtres */}
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

          {/* Filtre client (dropdown + clear si filtré) */}
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <SelectField
                label="Client"
                placeholder="Tous les clients"
                value={clientFilter}
                onChange={setClientFilter}
                options={clientOptions}
                isLoading={qCli.isLoading}
                emptyMessage="Aucun client"
                optional
              />
            </View>
            {clientFilter ? (
              <Pressable
                onPress={() => setClientFilter(null)}
                className="bg-slate-100 dark:bg-slate-800 px-3 py-3 rounded-md active:opacity-70 mb-1"
              >
                <X color="#64748b" size={14} />
              </Pressable>
            ) : null}
          </View>

          {/* Liste */}
          {q.isLoading ? (
            <View className="mt-6">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : q.isError ? (
            <View className="mt-3">
              <EmptyState
                title="Chargement impossible"
                message={extractApiErrorMessage(q.error, 'Impossible de charger les retours.')}
              />
            </View>
          ) : retours.length === 0 ? (
            <View className="mt-3">
              <EmptyState
                title="Aucun retour"
                message={
                  clientFilter
                    ? `Aucun retour pour ${clientLabel} sur cette période.`
                    : 'Aucun retour enregistré sur cette période.'
                }
              />
            </View>
          ) : (
            <View className="gap-2 mt-3">
              {retours.map((r) => {
                const correction = r.quantite < 0;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() =>
                      router.push({
                        pathname: '/(livreur)/livraisons/[id]' as never,
                        params: { id: r.livraison.id },
                      } as never)
                    }
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 rounded-md p-3 flex-row items-center gap-3 active:opacity-70 ${
                      correction ? 'border-l-slate-400' : 'border-l-amber-500'
                    }`}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Package color="#64748b" size={11} />
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                          {r.produit.designation}{' '}
                          · {libelleQuantite(r.quantite)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <User color="#94a3b8" size={10} />
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.client.nom ?? '—'} · {r.livraison.reference}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatDateShort(r.dateRetour)} · {r.livreur.nom ?? '—'}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {libelleDestination(r.remisEnStock)} · {libelleOrigine(r.origine)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-extrabold text-slate-700 dark:text-slate-300">
                        {libelleValeur(r.valeur)}
                      </Text>
                      <Text className="text-[9px] text-slate-400 dark:text-slate-500">
                        FCFA
                      </Text>
                    </View>
                    <ArrowRight color="#94a3b8" size={14} />
                  </Pressable>
                );
              })}

              {q.hasNextPage ? (
                <Pressable
                  onPress={() => q.fetchNextPage()}
                  disabled={q.isFetchingNextPage}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md py-3 items-center active:opacity-70"
                >
                  {q.isFetchingNextPage ? (
                    <ActivityIndicator color="#10b981" />
                  ) : (
                    <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                      Charger plus ({retours.length} / {total})
                    </Text>
                  )}
                </Pressable>
              ) : null}
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
