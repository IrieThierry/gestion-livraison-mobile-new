import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeftRight, Users, ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useStockCourant } from '../../../features/stock/hooks';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Écran "Mon stock" — affiche le **stock courant livreur** Plan D
 * (table `stock_courant_livreur`), c'est-à-dire la quantité réellement
 * vendable APRÈS prise en compte des livraisons et des retours.
 *
 * Source : `GET /stock-livreur/me/courant` qui renvoie une ligne par
 * produit avec `qteVendable` (= achats − livraisons + retours sur la
 * période). C'est ce que le portail web montre aussi sur sa page Stock.
 *
 * NB : on n'utilise plus `useStockActuel` (= ventilation par achat ×
 * fournisseur, qui ne déduit pas les livraisons et donc affichait du
 * "stock à l'achat" trompeur).
 */
export default function StockCourant() {
  const user = useAuthStore((s) => s.user);
  const q = useStockCourant();
  const items = q.data ?? [];

  if (!user) return null;

  // Total unités vendables sur tout le stock (somme des qteVendable).
  const totalUnites = items.reduce((acc, s) => acc + (s.qteVendable ?? 0), 0);

  // Total des retours cumulés sur la période — informatif.
  const totalRetours = items.reduce(
    (acc, s) => acc + (s.qteRetourneeSurPeriode ?? 0),
    0,
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mon stock"
        subtitle={`${items.length} produit${items.length > 1 ? 's' : ''}`}
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
        <View className="px-4">
          {/* Carte hero — total vendable */}
          <View className="bg-emerald-500 rounded-lg p-4 shadow-md">
            <Text className="text-[10px] font-semibold uppercase text-white/90">
              Vendable maintenant
            </Text>
            <Text className="text-3xl font-extrabold text-white mt-1">
              {totalUnites} <Text className="text-sm">unités</Text>
            </Text>
            <Text className="text-xs text-white/90 mt-1">
              {items.length} produit{items.length > 1 ? 's' : ''}
              {totalRetours > 0 ? ` · ${totalRetours} retours sur période` : ''}
            </Text>
          </View>

          {/* Submenu (root only) */}
          {user.role === 'LIVREUR' && (user.parentId ?? null) === null ? (
            <View className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <Pressable
                onPress={() => router.push('/(livreur)/stock/transferts' as never)}
                className="flex-row items-center justify-between px-4 py-3 active:opacity-70"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <ArrowLeftRight color="#3b82f6" size={20} />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      Transferts
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Vers / depuis tes apprentis
                    </Text>
                  </View>
                </View>
                <ArrowRight color="#94a3b8" size={16} />
              </Pressable>
              <Pressable
                onPress={() => router.push('/(livreur)/stock/equipe' as never)}
                className="flex-row items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 active:opacity-70"
              >
                <View className="flex-row items-center gap-3 flex-1">
                  <Users color="#8b5cf6" size={20} />
                  <View className="flex-1">
                    <Text className="font-extrabold text-slate-900 dark:text-white">
                      Stock équipe
                    </Text>
                    <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                      Vue agrégée toi + apprentis
                    </Text>
                  </View>
                </View>
                <ArrowRight color="#94a3b8" size={16} />
              </Pressable>
            </View>
          ) : null}

          {/* Liste */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Par produit
          </Text>

          {q.isLoading ? (
            <Text className="text-slate-400 text-sm">Chargement…</Text>
          ) : items.length === 0 ? (
            <EmptyState
              title="Stock vide"
              message="Déclare un achat via le bouton + pour réapprovisionner."
            />
          ) : (
            <View className="gap-2">
              {items.map((it) => {
                const designation = it.produit?.designation ?? '—';
                const code = it.produit?.code ?? '';
                const qte = it.qteVendable ?? 0;
                const retours = it.qteRetourneeSurPeriode ?? 0;
                const lowStock = qte < 5;
                const outOfStock = qte === 0;
                const borderColor = outOfStock
                  ? 'border-l-red-500'
                  : lowStock
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500';
                return (
                  <View
                    key={it.produit?.id ?? code}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${borderColor} rounded-lg p-3 flex-row items-start justify-between`}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {designation}
                      </Text>
                      {code ? (
                        <Text className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {code}
                        </Text>
                      ) : null}
                      {retours > 0 ? (
                        <Text className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                          {retours} retour{retours > 1 ? 's' : ''} sur la période
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-2xl font-extrabold ${
                          outOfStock
                            ? 'text-red-600 dark:text-red-400'
                            : lowStock
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-slate-900 dark:text-white'
                        }`}
                      >
                        {qte}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                        unité{qte > 1 ? 's' : ''}
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
