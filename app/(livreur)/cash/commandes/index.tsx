import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import {
  CommandeStatusBadge,
  ReglementBadge,
} from '../../../../components/livreur/CommandeStatusBadge';
import { useMesCommandes } from '../../../../features/commandes/hooks';
import {
  FILTRES_STATUT_COMMANDE,
  type FiltreStatutCommande,
} from '../../../../features/commandes/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { formatDateShort, formatFCFA } from '../../../../lib/format';

export default function CommandesList() {
  const user = useAuthStore((s) => s.user);
  const isRootLivreur = !!user && !user.parentId;
  const q = useMesCommandes(isRootLivreur);
  const [filtre, setFiltre] = useState<FiltreStatutCommande>('TOUTES');

  // Plus récentes d'abord, puis filtre par statut.
  const visibles = useMemo(() => {
    const triees = [...(q.data ?? [])].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
    return filtre === 'TOUTES' ? triees : triees.filter((c) => c.statut === filtre);
  }, [q.data, filtre]);

  if (!user) return null;

  if (!isRootLivreur) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Commandes" fallback="/(livreur)/cash" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal peut passer des commandes auprès d'un fournisseur."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Commandes"
        subtitle={`${q.data?.length ?? 0} commande${(q.data?.length ?? 0) > 1 ? 's' : ''}`}
        fallback="/(livreur)/cash"
        right={
          <Pressable
            onPress={() => router.push('/(livreur)/cash/commandes/nouvelle' as never)}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouvelle</Text>
          </Pressable>
        }
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 grow-0"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      >
        {FILTRES_STATUT_COMMANDE.map((f) => (
          <Pressable
            key={f.valeur}
            onPress={() => setFiltre(f.valeur)}
            className={`px-3 py-1.5 rounded-full ${
              filtre === f.valeur
                ? 'bg-emerald-500'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Text
              className={`text-[12px] font-bold ${
                filtre === f.valeur ? 'text-white' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        data={visibles}
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
          ) : (
            <EmptyState
              title="Aucune commande"
              message={
                filtre === 'TOUTES'
                  ? 'Appuie sur « Nouvelle » pour en passer une.'
                  : 'Aucune commande avec ce statut.'
              }
            />
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
            <Text className="text-[12px] text-slate-600 dark:text-slate-300 mt-1">
              {c.fournisseur.libelle}
            </Text>
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
          </Pressable>
        )}
      />
    </View>
  );
}
