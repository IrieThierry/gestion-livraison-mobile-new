import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import {
  Banknote,
  TrendingDown,
  Receipt,
  Coins,
  TrendingUp,
  ArrowRight,
  RotateCcw,
  ClipboardList,
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StatCard } from '../../../components/shared/StatCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useEncoursByLivreur } from '../../../features/clients/hooks';
import {
  encaisseAujourdhui,
  totalAEncaisser,
} from '../../../features/encaissements/regles';
import { useAuthStore } from '../../../stores/authStore';
import { formatMontant, formatDateShort } from '../../../lib/format';

// Onglet "Cash" du livreur (root de la stack /cash) :
// - 2 KPIs : « encaissé aujourd'hui » = Σ `montantEncaisse` des encaissements
//   dont `dateEncaissement` est aujourd'hui ; « à encaisser » = Σ des soldes
//   positifs des clients, calculés par le serveur (`/client/encours/livreur`).
// - CTA "Faire un versement", sous-menu, 30 encaissements les plus récents.
export default function CashOverview() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qE = useEncaissementsByLivreur(livreurId);
  const qEncours = useEncoursByLivreur(livreurId);

  const totalJour = useMemo(() => encaisseAujourdhui(qE.data ?? []), [qE.data]);
  const aEncaisser = useMemo(() => totalAEncaisser(qEncours.data ?? []), [qEncours.data]);

  if (!user) return null;

  const encs = qE.data ?? [];
  const sorted = [...encs].sort((a, b) => {
    const da = a.dateEncaissement ? new Date(a.dateEncaissement).getTime() : 0;
    const db = b.dateEncaissement ? new Date(b.dateEncaissement).getTime() : 0;
    return db - da;
  });

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Cash" subtitle="Encaissements & versements" showBack={false} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={qE.isFetching && !qE.isLoading}
            onRefresh={() => {
              qE.refetch();
              qEncours.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          {/* Stat cards */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <StatCard label="Encaissé jour" value={formatMontant(totalJour)} accent="emerald" />
            </View>
            <View className="flex-1">
              <StatCard label="À encaisser" value={formatMontant(aEncaisser)} accent="amber" />
            </View>
          </View>

          {/* Versement CTA */}
          <Pressable
            onPress={() => router.push('/(livreur)/cash/versement' as never)}
            className="bg-emerald-500 rounded-lg p-4 mt-4 flex-row items-center gap-3 active:opacity-80"
          >
            <View className="w-10 h-10 rounded-full bg-white/20 items-center justify-center">
              <TrendingDown color="#fff" size={22} />
            </View>
            <View className="flex-1">
              <Text className="text-white font-extrabold text-base">Faire un versement</Text>
              <Text className="text-white/85 text-[12px]">À un fournisseur</Text>
            </View>
          </Pressable>

          {/* Cash submenu */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Plus
          </Text>
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            <CashMenuRow
              icon={Receipt}
              color="#dc2626"
              label="Mes dépenses"
              hint="Carburant, entretien, divers"
              onPress={() => router.push('/(livreur)/cash/depenses' as never)}
            />
            <CashMenuRow
              icon={Coins}
              color="#8b5cf6"
              label="Reversements"
              hint="Marges dues aux clients / fournisseurs"
              onPress={() => router.push('/(livreur)/cash/reversements' as never)}
              border
            />
            <CashMenuRow
              icon={RotateCcw}
              color="#f59e0b"
              label="Retours"
              hint="Liste des retours par client + filtres"
              onPress={() => router.push('/(livreur)/cash/retours' as never)}
              border
            />
            {/* Encours et Commandes visibles pour les livreurs racines (pas pour les apprentis) */}
            {!user.parentId ? (
              <>
                <CashMenuRow
                  icon={ClipboardList}
                  color="#0ea5e9"
                  label="Commandes"
                  hint="Commandes auprès des fournisseurs"
                  onPress={() => router.push('/(livreur)/cash/commandes' as never)}
                  border
                />
                <CashMenuRow
                  icon={TrendingUp}
                  color="#f59e0b"
                  label="Encours clients"
                  hint="Synthèse des créances clients"
                  onPress={() => router.push('/(livreur)/cash/encours' as never)}
                  border
                />
              </>
            ) : null}
          </View>

          {/* Recent list */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Encaissements récents
          </Text>

          {qE.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : sorted.length === 0 ? (
            <EmptyState
              title="Aucun encaissement"
              message="Encaisse une livraison depuis sa page de détail."
            />
          ) : (
            <View className="gap-2">
              {sorted.slice(0, 30).map((e) => {
                const clientName = e.client
                  ? `${e.client.prenom ?? ''} ${e.client.nom ?? ''}`.trim()
                  : '';
                return (
                  <View
                    key={e.reference}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-lg p-3 flex-row items-center justify-between"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {clientName || 'Encaissement'}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {e.dateEncaissement ? formatDateShort(e.dateEncaissement) : '—'}
                        {e.commentaire ? ` · ${e.commentaire}` : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Banknote color="#10b981" size={18} />
                      <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatMontant(e.montantEncaisse)} F
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

function CashMenuRow({
  icon: Icon,
  color,
  label,
  hint,
  onPress,
  border,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  color: string;
  label: string;
  hint: string;
  onPress: () => void;
  border?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center justify-between px-4 py-3 active:opacity-70 ${
        border ? 'border-t border-slate-100 dark:border-slate-800' : ''
      }`}
    >
      <View className="flex-row items-center gap-3 flex-1">
        <Icon color={color} size={20} />
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">
            {label}
          </Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400">
            {hint}
          </Text>
        </View>
      </View>
      <ArrowRight color="#94a3b8" size={16} />
    </Pressable>
  );
}
