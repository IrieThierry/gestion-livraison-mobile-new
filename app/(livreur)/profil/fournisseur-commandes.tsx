import { View, Text, FlatList, Pressable, RefreshControl } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import {
  CommandeStatusBadge,
  ReglementBadge,
} from '../../../components/livreur/CommandeStatusBadge';
import { BoutonReceptions } from '../../../components/livreur/BoutonReceptions';
import { useCommandesFournisseur } from '../../../features/commandes/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort, formatFCFA } from '../../../lib/format';

/**
 * Commandes du livreur principal chez un fournisseur (`GET /commande/me?fournisseurId=`),
 * ouvertes depuis « Mes fournisseurs ». Réservé au livreur principal : un apprenti n'y accède pas.
 */
export default function FournisseurCommandes() {
  const { id, libelle } = useLocalSearchParams<{ id: string; libelle?: string }>();
  const user = useAuthStore((s) => s.user);
  const estPrincipal = !!user && !user.parentId;
  const q = useCommandesFournisseur(id, estPrincipal);

  if (!user) return null;

  if (!estPrincipal) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Commandes" fallback="/(livreur)/profil/fournisseurs" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal consulte les commandes par fournisseur."
        />
      </View>
    );
  }

  const commandes = q.data ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Commandes"
        subtitle={libelle}
        fallback="/(livreur)/profil/fournisseurs"
      />
      <FlatList
        data={commandes}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <Text className="text-red-600 dark:text-red-400 text-sm px-1 pt-4">
              {extractApiErrorMessage(q.error, 'Commandes indisponibles')}
            </Text>
          ) : (
            <EmptyState title="Aucune commande chez ce fournisseur" />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: c }) => (
          <Pressable
            onPress={() => router.push(`/(livreur)/cash/commandes/${c.id}` as never)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 active:opacity-80"
          >
            <View className="flex-row items-center justify-between">
              <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                {c.reference}
              </Text>
              <View className="flex-row items-center gap-1">
                <CommandeStatusBadge statut={c.statut} />
                {c.versementId ? <ReglementBadge /> : null}
              </View>
            </View>
            <View className="flex-row items-center justify-between mt-1">
              <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                {formatDateShort(c.date)}
              </Text>
              {c.montantLivre != null ? (
                <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-[12px]">
                  {formatFCFA(c.montantLivre)} F
                </Text>
              ) : null}
            </View>
            {c.remiseLivreurLivree != null && c.remiseLivreurLivree > 0 ? (
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Remise livreur : {formatFCFA(c.remiseLivreurLivree)} F
              </Text>
            ) : null}
            <BoutonReceptions commandeId={c.id} nombre={c.receptions.length} />
          </Pressable>
        )}
      />
    </View>
  );
}
