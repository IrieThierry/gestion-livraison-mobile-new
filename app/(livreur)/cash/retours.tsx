import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
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
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA, formatDateShort } from '../../../lib/format';

type Periode = '7j' | '30j' | '90j' | 'all';

const PERIODES: Array<{ key: Periode; label: string; days: number | null }> = [
  { key: '7j', label: '7 jours', days: 7 },
  { key: '30j', label: '30 jours', days: 30 },
  { key: '90j', label: '90 jours', days: 90 },
  { key: 'all', label: 'Tout', days: null },
];

interface RetourItem {
  livraisonId: string;
  produitLivraisonId: string;
  date: string;
  clientId: string;
  clientName: string;
  produitName: string;
  qteRetournee: number;
  prixUnitaire: number;
  montant: number;
}

/**
 * Liste des retours client.
 *
 * Source : on dérive les retours de la liste des livraisons — chaque
 * `produitLivraison` avec `qteRetourne > 0` représente un retour. Cette
 * approche évite un endpoint dédié côté back (les retours sont stockés
 * inline sur la `ProduitLivraison`).
 *
 * Filtres :
 *   - Client (dropdown, optionnel) — pré-rempli si on arrive avec
 *     `?clientId=X` (depuis la fiche client)
 *   - Période (7j / 30j / 90j / Tout)
 *
 * Tri : plus récent en premier.
 */
export default function RetoursList() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const qLiv = useLivraisonsByLivreur(livreurId);
  const qCli = useClientsByLivreur(livreurId);

  const [periode, setPeriode] = useState<Periode>('30j');
  const [clientFilter, setClientFilter] = useState<string | null>(
    params.clientId ?? null,
  );

  const clientOptions = useMemo(
    () =>
      [...(qCli.data ?? [])]
        .sort((a, b) =>
          `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, 'fr'),
        )
        .map((c) => ({ id: c.id, label: `${c.prenom} ${c.nom}`.trim() })),
    [qCli.data],
  );

  // Aplatit toutes les livraisons → liste de retours individuels
  const allRetours = useMemo<RetourItem[]>(() => {
    const items: RetourItem[] = [];
    for (const l of qLiv.data ?? []) {
      for (const p of l.produitsLivraison ?? []) {
        const qte = p.qteRetourne ?? 0;
        if (qte <= 0) continue;
        const prix = Number(p.prixDeVente) || 0;
        items.push({
          livraisonId: l.id,
          produitLivraisonId: p.id,
          date: l.date,
          clientId: l.client.id,
          clientName: `${l.client.prenom} ${l.client.nom}`.trim(),
          produitName: p.produit?.designation ?? '—',
          qteRetournee: qte,
          prixUnitaire: prix,
          montant: prix * qte,
        });
      }
    }
    return items;
  }, [qLiv.data]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const days = PERIODES.find((p) => p.key === periode)?.days ?? null;
    return allRetours
      .filter((r) => {
        if (clientFilter && r.clientId !== clientFilter) return false;
        if (days !== null && now - new Date(r.date).getTime() > days * 86_400_000) {
          return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allRetours, periode, clientFilter]);

  const totalQte = filtered.reduce((acc, r) => acc + r.qteRetournee, 0);
  const totalMontant = filtered.reduce((acc, r) => acc + r.montant, 0);
  const nbClientsConcernes = new Set(filtered.map((r) => r.clientId)).size;

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
            refreshing={qLiv.isFetching && !qLiv.isLoading}
            onRefresh={() => qLiv.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* KPIs */}
          <View className="flex-row gap-2">
            <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Retours
              </Text>
              <Text className="text-base font-extrabold text-slate-900 dark:text-white mt-1">
                {filtered.length}
              </Text>
              <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {totalQte} unité{totalQte > 1 ? 's' : ''}
              </Text>
            </View>
            <View className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
              <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">
                Montant déduit
              </Text>
              <Text className="text-base font-extrabold text-amber-700 dark:text-amber-400 mt-1">
                {formatFCFA(totalMontant)} F
              </Text>
              <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                {nbClientsConcernes} client{nbClientsConcernes > 1 ? 's' : ''}
              </Text>
            </View>
          </View>

          {/* Filtres */}
          <View className="flex-row items-center gap-1.5 mt-4 mb-2">
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
          {filtered.length === 0 ? (
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
              {filtered.map((r) => (
                <Pressable
                  key={r.produitLivraisonId}
                  onPress={() =>
                    router.push({
                      pathname: '/(livreur)/livraisons/[id]' as never,
                      params: { id: r.livraisonId },
                    } as never)
                  }
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-md p-3 flex-row items-center gap-3 active:opacity-70"
                >
                  <View className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-500/15 items-center justify-center">
                    <RotateCcw color="#d97706" size={16} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-1.5">
                      <Package color="#64748b" size={11} />
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {r.produitName} × {r.qteRetournee}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      <User color="#94a3b8" size={10} />
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                        {r.clientName}
                      </Text>
                    </View>
                    <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                      {formatDateShort(r.date)} · {formatFCFA(r.prixUnitaire)} F l'unité
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text className="font-extrabold text-amber-700 dark:text-amber-400">
                      −{formatFCFA(r.montant)}
                    </Text>
                    <Text className="text-[9px] text-slate-400 dark:text-slate-500">
                      FCFA
                    </Text>
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
