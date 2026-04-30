import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { useStockActuel } from '../../../features/stock/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';

// Écran "Mon stock" — Task 22.
// Source : `GET /stock-livreur/{livreurId}/actuel` qui renvoie le stock
// embarqué ventilé par (produit × fournisseur). C'est exactement ce que la
// spec mobile demande : une ligne par tuple produit/fournisseur avec sa
// quantité, le coût d'achat, et un signal visuel "stock faible" en dessous
// de 5 unités.
export default function StockCourant() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useStockActuel(livreurId);
  const items = q.data ?? [];

  if (!user) return null;

  // Total unités vendables sur tout le stock (somme des qte par tuple).
  const totalUnites = items.reduce((acc, s) => acc + (s.qte ?? 0), 0);

  // Nombre de produits distincts (un produit peut apparaître sur plusieurs
  // lignes si acheté chez plusieurs fournisseurs).
  const produitsDistincts = new Set(items.map((s) => s.produit?.id).filter(Boolean)).size;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mon stock"
        subtitle={`${items.length} ligne${items.length > 1 ? 's' : ''} · ${produitsDistincts} produit${produitsDistincts > 1 ? 's' : ''}`}
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
              {produitsDistincts} produit{produitsDistincts > 1 ? 's' : ''} · {items.length} ligne
              {items.length > 1 ? 's' : ''}
            </Text>
          </View>

          {/* Liste */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Par produit / fournisseur
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
                const fournisseur = it.fournisseur?.libelle ?? '—';
                const qte = it.qte ?? 0;
                const lowStock = qte < 5;
                const borderColor = lowStock
                  ? 'border-l-amber-500'
                  : 'border-l-emerald-500';
                return (
                  <View
                    key={it.id}
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
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {fournisseur}
                      </Text>
                      {it.coutTotal ? (
                        <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Coût {formatFCFA(it.coutTotal)} FCFA
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      <Text
                        className={`text-2xl font-extrabold ${
                          lowStock
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
