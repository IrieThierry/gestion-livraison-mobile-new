import { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';
import { useMouvementsStock } from '../../../features/stock/hooks';
import { filtresDuJour, produitsVendus } from '../../../features/accueil/regles';
import { useAuthStore } from '../../../stores/authStore';
import { extractApiErrorMessage } from '../../../lib/api-error';

/**
 * « Produits vendus aujourd'hui » (chiffre cliquable de l'accueil) : détail
 * par produit des quantités livrées du jour, d'après les mouvements de stock
 * du livreur connecté (livré seulement, retours non déduits). Tri par
 * quantité décroissante. Même lecture que l'accueil (cache partagé).
 */
export default function ProduitsVendusAujourdhui() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const filtres = useMemo(() => filtresDuJour(), []);
  const q = useMouvementsStock(livreurId, filtres);
  const lignes = useMemo(() => produitsVendus(q.data ?? [], filtres.debut), [q.data, filtres.debut]);
  const total = lignes.reduce((a, l) => a + l.quantite, 0);

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Produits vendus aujourd'hui"
        subtitle={
          q.isLoading || q.isError
            ? undefined
            : `${total} unité${total > 1 ? 's' : ''} · ${lignes.length} produit${lignes.length > 1 ? 's' : ''}`
        }
      />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        {q.isLoading ? (
          <View className="py-6 items-center">
            <ActivityIndicator color="#10b981" />
          </View>
        ) : q.isError ? (
          <EmptyState
            title="Chargement impossible"
            message={extractApiErrorMessage(q.error, 'Ventes indisponibles')}
          />
        ) : lignes.length === 0 ? (
          <EmptyState title="Aucune vente aujourd'hui" message="Les produits livrés aujourd'hui apparaîtront ici." />
        ) : (
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1">
            {lignes.map((l, i) => (
              <View
                key={l.produitId}
                className={`flex-row items-center py-2.5 ${
                  i === 0 ? '' : 'border-t border-slate-100 dark:border-slate-800'
                }`}
              >
                <View className="mr-3">
                  <ProduitVignette designation={l.designation} photoUrl={l.photoUrl} size={36} />
                </View>
                <Text
                  className="flex-1 text-[14px] text-slate-800 dark:text-slate-200 pr-2"
                  numberOfLines={2}
                >
                  {l.designation}
                </Text>
                <Text className="text-[15px] font-extrabold text-slate-900 dark:text-white">
                  {l.quantite}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
