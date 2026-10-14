import { useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { ChevronRight, FilePen, Plus, Wallet } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../components/shared/EmptyState';
import { SearchInput } from '../../../../components/shared/SearchInput';
import { useVersementsLivreur } from '../../../../features/versements/hooks';
import {
  rechercherVersements,
  totalVerse,
  trierVersements,
} from '../../../../features/versements/regles';
import { useAuthStore } from '../../../../stores/authStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { AUCUN_RESULTAT } from '../../../../lib/recherche';
import { formatDateLong, formatFCFA } from '../../../../lib/format';
import { naviguer } from '../../../../lib/navigation-app';

/**
 * « Mes versements » : versements du livreur principal à ses fournisseurs
 * (`GET /versement/livreur/{id}`), du plus récent au plus ancien, avec
 * recherche et total. « Nouveau versement » ouvre le formulaire ; après
 * enregistrement on revient ici (liste rafraîchie). Un apprenti ne verse
 * pas : écran d'information, comme le formulaire.
 */
export default function MesVersements() {
  const user = useAuthStore((s) => s.user);
  const estPrincipal = !!user && !user.parentId;
  const q = useVersementsLivreur(estPrincipal ? user?.id : undefined);
  const [recherche, setRecherche] = useState('');

  const tous = useMemo(() => trierVersements(q.data ?? []), [q.data]);
  const affiches = useMemo(() => rechercherVersements(tous, recherche), [tous, recherche]);
  const total = totalVerse(affiches);

  if (!user) return null;

  if (!estPrincipal) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Mes versements" />
        <EmptyState
          title="Réservé au livreur principal"
          message="Seul le livreur principal règle les commandes auprès des fournisseurs."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes versements"
        subtitle={`${affiches.length} versement${affiches.length > 1 ? 's' : ''} · ${formatFCFA(total)} FCFA`}
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/cash/versement')}
            accessibilityRole="button"
            accessibilityLabel="Nouveau versement"
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Plus color="#fff" size={14} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      <View className="px-4 pb-2">
        <Pressable
          onPress={() => naviguer('/(livreur)/cash/versements/demandes')}
          accessibilityRole="button"
          className="flex-row items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2.5 mb-2 active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            <FilePen color="#b45309" size={16} />
            <Text className="font-bold text-slate-900 dark:text-white text-[13px]">Demandes de modification</Text>
          </View>
          <ChevronRight color="#94a3b8" size={16} />
        </Pressable>
        <SearchInput
          value={recherche}
          onChangeText={setRecherche}
          placeholder="Rechercher un fournisseur, un commentaire…"
        />
      </View>

      <FlatList
        data={q.isError ? [] : affiches}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 4 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
        ListHeaderComponent={
          !q.isLoading && !q.isError && affiches.length > 0 ? (
            <View className="flex-row justify-between items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-amber-500 rounded-lg px-3 py-2 mb-2">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Total versé
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {formatFCFA(total)} FCFA
              </Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          q.isLoading ? (
            <View className="py-6 items-center">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : q.isError ? (
            <EmptyState
              title="Chargement impossible"
              message={extractApiErrorMessage(q.error, 'Impossible de charger les versements.')}
            />
          ) : tous.length > 0 ? (
            <EmptyState title={AUCUN_RESULTAT} message="Aucun versement ne correspond à la recherche." />
          ) : (
            <EmptyState
              title="Aucun versement"
              message="Enregistre tes versements aux fournisseurs avec le bouton « Nouveau »."
            />
          )
        }
        renderItem={({ item }) => (
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3 mb-2">
          <View className="flex-row items-center gap-3">
            <View className="w-10 h-10 rounded-full items-center justify-center bg-amber-100 dark:bg-amber-500/15">
              <Wallet color="#b45309" size={16} />
            </View>
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {item.fournisseur?.libelle ?? 'Fournisseur'}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {formatDateLong(item.dateVersement)}
                {item.commentaire ? ` · ${item.commentaire}` : ''}
              </Text>
            </View>
            <View className="items-end">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {formatFCFA(Number(item.montantVerse))}
              </Text>
              <Text className="text-[10px] text-slate-400 dark:text-slate-500">FCFA</Text>
            </View>
          </View>
          <Pressable
            onPress={() => naviguer('/(livreur)/cash/versements/modifier', { versementId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={`Demander une modification du versement ${item.fournisseur?.libelle ?? ''}`.trim()}
            className="self-start mt-2 active:opacity-60"
          >
            <Text className="text-[12px] font-bold text-amber-700 dark:text-amber-400">Demander une modification</Text>
          </Pressable>
          </View>
        )}
      />
    </View>
  );
}
