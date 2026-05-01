import { useMemo } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Bell, Package, Truck, Banknote, RotateCcw } from 'lucide-react-native';
import { useLivraisonsByLivreur } from '../../features/livraisons/hooks';
import { useStockCourant } from '../../features/stock/hooks';
import { useAuthStore } from '../../stores/authStore';
import { EmptyState } from '../../components/shared/EmptyState';
import { PendingValidationGate } from '../../components/shared/PendingValidationGate';
import { LivraisonCard } from '../../components/livreur/LivraisonCard';
import { formatFCFA } from '../../lib/format';

export default function Tournee() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const qLiv = useLivraisonsByLivreur(livreurId);
  // Stock courant (Plan D) — somme des `qteVendable` (= achats − livraisons
  // + retours sur la période). C'est ce que l'écran Stock affiche aussi.
  // L'ancien `useStockActuel` retournait des `AchatResponse[]` dont la `qte`
  // est la quantité d'achat initiale, ce qui donnait un cumul gonflé sur
  // l'accueil — on n'en veut plus.
  const qStock = useStockCourant();

  const computed = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86_400_000).toDateString();

    const all = qLiv.data ?? [];
    const duJour = all.filter((l) => new Date(l.date).toDateString() === today);
    const dHier = all.filter((l) => new Date(l.date).toDateString() === yesterday);

    const totalEncaisseAujourd = duJour
      .filter((l) => l.statut === 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    const totalEncaisseHier = dHier
      .filter((l) => l.statut === 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    const aEncaisser = duJour
      .filter((l) => l.statut !== 'ENCAISSEE')
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);
    const clientsAEncaisser = new Set(
      duJour.filter((l) => l.statut !== 'ENCAISSEE').map((l) => l.client.id),
    ).size;

    let varPct: number | null = null;
    if (totalEncaisseHier > 0) {
      varPct = Math.round(((totalEncaisseAujourd - totalEncaisseHier) / totalEncaisseHier) * 100);
    }

    // Marge cristallisée Plan D : Σ qteLivree × margeUnitaire (sur les lignes)
    // de toutes les livraisons du jour (encaissées ou non — la marge est
    // gagnée à la livraison, indépendamment de l'encaissement).
    const margeApprox = duJour.reduce((acc, l) => {
      const ligneMarge = (l.produitsLivraison ?? []).reduce((s, p) => {
        const qte = (p.qteLivre ?? 0) - (p.qteRetourne ?? 0);
        return s + (Number(p.margeUnitaire) || 0) * qte;
      }, 0);
      return acc + ligneMarge;
    }, 0);

    return {
      duJour,
      totalEncaisseAujourd,
      aEncaisser,
      clientsAEncaisser,
      margeApprox,
      varPct,
    };
  }, [qLiv.data]);

  const totalStock = useMemo(
    () => (qStock.data ?? []).reduce((acc, s) => acc + (s.qteVendable ?? 0), 0),
    [qStock.data],
  );

  if (!user) return null;

  const initials = `${user.prenom?.[0] ?? ''}${user.nom?.[0] ?? ''}`.toUpperCase();
  const notifCount = 0; // wire to real notifications endpoint later

  const onRefresh = () => {
    qLiv.refetch();
    qStock.refetch();
  };

  return (
    <PendingValidationGate>
    <ScrollView
      className="flex-1 bg-slate-50 dark:bg-slate-950"
      contentContainerStyle={{ paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={
            (qLiv.isFetching && !qLiv.isLoading) || (qStock.isFetching && !qStock.isLoading)
          }
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      <View className="px-4 pt-3">
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">Bonjour</Text>
            <Text className="font-extrabold text-slate-900 dark:text-white text-lg">
              {user.prenom} {user.nom?.[0] ?? ''}.
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <Pressable
              hitSlop={6}
              className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
            >
              <Bell color="#475569" size={18} />
              {notifCount > 0 ? (
                <View className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 items-center justify-center">
                  <Text className="text-white text-[9px] font-bold">{notifCount}</Text>
                </View>
              ) : null}
            </Pressable>
            <View className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
              <Text className="text-emerald-700 dark:text-emerald-400 font-extrabold text-xs">
                {initials || '?'}
              </Text>
            </View>
          </View>
        </View>

        {/* Hero card — solde du jour with sub-cards */}
        <View
          className="bg-emerald-500 mt-4 rounded-2xl p-4"
          style={{
            shadowColor: '#10b981',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <View className="flex-row items-center justify-between">
            <Text className="text-[10px] font-extrabold uppercase tracking-wider text-white/95">
              Solde du jour
            </Text>
            {computed.varPct !== null ? (
              <View className="bg-white/20 rounded-full px-2.5 py-1">
                <Text className="text-white text-[10px] font-extrabold">
                  {computed.varPct >= 0 ? '+' : ''}
                  {computed.varPct}% / hier
                </Text>
              </View>
            ) : null}
          </View>
          <Text className="text-white font-extrabold mt-1">
            <Text className="text-4xl">{formatFCFA(computed.totalEncaisseAujourd)}</Text>
            <Text className="text-base"> FCFA</Text>
          </Text>

          <View className="flex-row gap-2 mt-3">
            <View className="flex-1 bg-white/15 rounded-xl px-3 py-2">
              <Text className="text-[10px] uppercase font-bold tracking-wider text-white/90">
                Marge
              </Text>
              <Text className="text-white font-extrabold text-lg">
                + {formatFCFA(computed.margeApprox)}
              </Text>
            </View>
            <View className="flex-1 bg-white/15 rounded-xl px-3 py-2">
              <Text className="text-[10px] uppercase font-bold tracking-wider text-white/90">
                Livraisons
              </Text>
              <Text className="text-white font-extrabold text-lg">{computed.duJour.length}</Text>
            </View>
          </View>
        </View>

        {/* Stat cards — Stock + À encaisser */}
        <View className="flex-row gap-2 mt-3">
          <Pressable
            onPress={() => router.push('/(livreur)/stock' as never)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-xl p-3 active:opacity-70"
          >
            <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
              Stock
            </Text>
            <Text className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
              {totalStock}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              unités vendables
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(livreur)/livraisons' as never)}
            className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-xl p-3 active:opacity-70"
          >
            <Text className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">
              À encaisser
            </Text>
            <Text className="text-3xl font-extrabold text-slate-900 dark:text-white mt-0.5 leading-none">
              {formatFCFA(computed.aEncaisser)}
            </Text>
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {computed.clientsAEncaisser} client{computed.clientsAEncaisser > 1 ? 's' : ''}
            </Text>
          </Pressable>
        </View>

        {/* Actions rapides */}
        <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400 mt-5 mb-2">
          Actions rapides
        </Text>
        <View className="flex-row gap-2">
          <ActionCard
            icon={Package}
            label="Stock"
            onPress={() => router.push('/(livreur)/stock/declarer' as never)}
          />
          <ActionCard
            icon={Truck}
            label="Livrer"
            onPress={() => router.push('/(livreur)/livraisons/nouvelle' as never)}
          />
          <ActionCard
            icon={Banknote}
            label="Encaisser"
            onPress={() => router.push('/(livreur)/livraisons' as never)}
          />
          <ActionCard
            icon={RotateCcw}
            label="Retour"
            onPress={() => router.push('/(livreur)/cash/retour-client' as never)}
          />
        </View>

        {/* Tournée du jour */}
        <View className="flex-row items-center justify-between mt-5 mb-2">
          <Text className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 dark:text-slate-400">
            Ma tournée · aujourd'hui
          </Text>
          <Pressable
            onPress={() => router.push('/(livreur)/livraisons' as never)}
            className="active:opacity-70"
            hitSlop={6}
          >
            <Text className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
              Tout voir →
            </Text>
          </Pressable>
        </View>

        {qLiv.isLoading ? (
          <Text className="text-slate-400 text-sm">Chargement…</Text>
        ) : computed.duJour.length === 0 ? (
          <EmptyState
            title="Aucune livraison"
            message="Crée ta première livraison via le bouton ➕."
          />
        ) : (
          <View className="gap-2">
            {computed.duJour.slice(0, 5).map((l) => (
              <LivraisonCard key={l.id} livraison={l} />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
    </PendingValidationGate>
  );
}

function ActionCard({
  icon: Icon,
  label,
  onPress,
}: {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-3 items-center gap-2 active:opacity-70"
    >
      <View className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 items-center justify-center">
        <Icon color="#10b981" size={18} />
      </View>
      <Text className="text-[11px] font-extrabold text-slate-700 dark:text-slate-200">
        {label}
      </Text>
    </Pressable>
  );
}
