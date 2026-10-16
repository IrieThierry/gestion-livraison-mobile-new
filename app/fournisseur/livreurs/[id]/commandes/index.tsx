import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../../../components/shared/PageHeader';
import { EmptyState } from '../../../../../components/shared/EmptyState';
import { CarteCommandeFournisseur } from '../../../../../components/fournisseur/CommandeFournisseur';
import { useCommandesLivreurFournisseur, useLivreursPartenaires } from '../../../../../features/fournisseur/hooks';
import { nomLivreur } from '../../../../../features/fournisseur/gestion';
import { extractApiErrorMessage } from '../../../../../lib/api-error';
import { naviguer } from '../../../../../lib/navigation-app';

/** F2 : toutes les commandes d'un livreur partenaire chez toi, de la plus récente à la plus ancienne. */
export default function CommandesDuLivreur() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useCommandesLivreurFournisseur(id);
  const partenaire = useLivreursPartenaires().data?.find((p) => p.livreur.id === id);
  const nom = partenaire ? nomLivreur(partenaire.livreur) : undefined;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title={nom ? `Commandes de ${nom}` : 'Commandes du livreur'} subtitle="Toutes ses commandes chez toi" />
      <FlatList
        data={q.data ?? []}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, paddingTop: 8 }}
        refreshControl={
          <RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />
        }
        ListEmptyComponent={
          q.isLoading ? (
            <Text className="text-slate-400 text-sm px-1 pt-4">Chargement…</Text>
          ) : q.isError ? (
            <View className="pt-4 px-1 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">
                {extractApiErrorMessage(q.error, 'Commandes indisponibles')}
              </Text>
              <Pressable onPress={() => q.refetch()} accessibilityRole="button" className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <EmptyState title="Aucune commande" message="Ce livreur ne t’a encore rien commandé." />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: c }) => (
          <CarteCommandeFournisseur
            commande={c}
            afficherLivreur={false}
            onPress={() => naviguer(`/fournisseur/livreurs/${id}/commandes/${c.id}`)}
          />
        )}
      />
    </View>
  );
}
