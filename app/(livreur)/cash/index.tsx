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
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { StatCard } from '../../../components/shared/StatCard';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { isAEncaisser } from '../../../lib/livraison-status';
import { formatFCFA, formatDateShort } from '../../../lib/format';

// Onglet "Cash" du livreur (root de la stack /cash) :
// - 2 KPIs : encaissé du jour (somme des encaissements dont la `date` est
//   aujourd'hui) + à encaisser (somme des `montantLivre` des livraisons
//   non encaissées)
// - CTA "Faire un versement" qui route vers /(livreur)/cash/versement
//   (Task 25 construit cet écran)
// - Liste des 30 encaissements les plus récents (client, date, commentaire,
//   montant)
//
// Source de vérité : `EncaissementLivraisonResponse` exposé par
// `GET /encaissement/livraison/livreur/{livreurId}`. Champs utilisés :
// `reference` (key), `date`, `montantEncaisse`, `client`, `commentaire`.
export default function CashOverview() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qE = useEncaissementsByLivreur(livreurId);
  const qL = useLivraisonsByLivreur(livreurId);

  const { totalJour, aEncaisser } = useMemo(() => {
    const encs = qE.data ?? [];
    const today = new Date().toDateString();
    const totalJour = encs
      .filter((e) => (e.date ? new Date(e.date).toDateString() === today : false))
      .reduce((acc, e) => acc + (e.montantEncaisse ?? 0), 0);
    const livraisons = qL.data ?? [];
    const aEncaisser = livraisons
      .filter(isAEncaisser)
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    return { totalJour, aEncaisser };
  }, [qE.data, qL.data]);

  if (!user) return null;

  const encs = qE.data ?? [];
  const sorted = [...encs].sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
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
              qL.refetch();
            }}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          {/* Stat cards */}
          <View className="flex-row gap-2">
            <View className="flex-1">
              <StatCard label="Encaissé jour" value={formatFCFA(totalJour)} accent="emerald" />
            </View>
            <View className="flex-1">
              <StatCard label="À encaisser" value={formatFCFA(aEncaisser)} accent="amber" />
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
            {/* Encours visible pour les livreurs racines (pas pour les apprentis) */}
            {!user.parentId ? (
              <CashMenuRow
                icon={TrendingUp}
                color="#f59e0b"
                label="Encours clients"
                hint="Synthèse des créances clients"
                onPress={() => router.push('/(livreur)/cash/encours' as never)}
                border
              />
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
                        {e.date ? formatDateShort(e.date) : '—'}
                        {e.commentaire ? ` · ${e.commentaire}` : ''}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2">
                      <Banknote color="#10b981" size={18} />
                      <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                        {formatFCFA(e.montantEncaisse)} F
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
