import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Bell, PackagePlus } from 'lucide-react-native';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { CARTE_COMMIS, TableauQuantites } from '../../components/commis/ElementsCommis';
import { useCommandesCommis, useLivreursCommis } from '../../features/commis/hooks';
import { dateHeure, libelleStatutCommande, nomPersonne } from '../../features/commis/regles';
import { useNombreNonLues } from '../../features/notifications/hooks';
import { badgeNonLues } from '../../features/notifications/regles';
import { NOTIFICATIONS_COMMIS } from '../../lib/navigation';
import { naviguer, ouvrir } from '../../lib/navigation-app';
import { extractApiErrorMessage } from '../../lib/api-error';
import type { CommandeCommisResponse } from '../../types/api';

/**
 * Onglet Commandes du commis (accueil de son espace) : les commandes
 * confirmées ou en réception des livreurs partenaires de son fournisseur,
 * plus anciennes d'abord, filtrables par livreur. Pour chaque produit :
 * commandé, remis (confirmé) et en attente de confirmation. Aucun prix ni
 * montant. « Remise sans commande » pour un livreur titulaire.
 */
export default function CommandesCommis() {
  const [livreurId, setLivreurId] = useState<string | undefined>(undefined);
  const q = useCommandesCommis(livreurId);
  const livreurs = useLivreursCommis().data ?? [];
  const nonLues = useNombreNonLues(true).data ?? 0;
  const commandes = q.data ?? [];

  const filtres = [{ id: undefined as string | undefined, label: 'Tous les livreurs' }, ...livreurs.map((l) => ({ id: l.id as string | undefined, label: nomPersonne(l) }))];

  const cloche = (
    <Pressable
      onPress={() => ouvrir(NOTIFICATIONS_COMMIS)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      className="w-9 h-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 items-center justify-center active:opacity-70"
    >
      <Bell color="#64748b" size={18} />
      {nonLues > 0 ? (
        <View className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 items-center justify-center">
          <Text className="text-white text-[9px] font-bold">{badgeNonLues(nonLues)}</Text>
        </View>
      ) : null}
    </Pressable>
  );

  const enTete = (
    <View className="px-4 pb-2 gap-3">
      <Pressable
        onPress={() => naviguer('/commis/remise-sans-commande')}
        accessibilityRole="button"
        accessibilityLabel="Remise sans commande"
        className="flex-row items-center justify-center gap-2 rounded-md py-3 bg-emerald-700 active:opacity-80"
      >
        <PackagePlus color="#fff" size={16} />
        <Text className="text-white font-bold text-[14px]">Remise sans commande</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {filtres.map((f) => {
          const choisi = f.id === livreurId;
          return (
            <Pressable
              key={f.id ?? 'tous'}
              onPress={() => setLivreurId(f.id)}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer : ${f.label}`}
              accessibilityState={{ selected: choisi }}
              className={`px-3 py-1.5 rounded-full border active:opacity-70 ${
                choisi ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
              }`}
            >
              <Text className={`text-[12px] font-bold ${choisi ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Commandes" subtitle="À servir aux livreurs de ton fournisseur" showBack={false} right={cloche} />
      <FlatList
        data={commandes}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={enTete}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={<RefreshControl refreshing={q.isFetching && !q.isLoading} onRefresh={() => q.refetch()} tintColor="#047857" />}
        renderItem={({ item }) => <CarteCommande commande={item} />}
        ItemSeparatorComponent={() => <View className="h-2" />}
        ListEmptyComponent={
          q.isLoading ? (
            <View className="items-center py-10">
              <ActivityIndicator color="#047857" />
            </View>
          ) : q.isError ? (
            <View className="px-4 gap-2">
              <Text className="text-red-600 dark:text-red-400 text-sm">{extractApiErrorMessage(q.error, 'Commandes indisponibles')}</Text>
              <Pressable onPress={() => q.refetch()} className="self-start active:opacity-70">
                <Text className="text-emerald-700 dark:text-emerald-400 font-bold text-[13px]">Réessayer</Text>
              </Pressable>
            </View>
          ) : (
            <View className="px-4">
              <EmptyState title="Aucune commande à servir." message="Les commandes confirmées des livreurs apparaissent ici." />
            </View>
          )
        }
      />
    </View>
  );
}

function CarteCommande({ commande: c }: { commande: CommandeCommisResponse }) {
  return (
    <Pressable
      onPress={() => naviguer(`/commis/commandes/${c.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir la commande ${c.numero}`}
      className={`${CARTE_COMMIS} mx-4 p-3 active:opacity-80`}
    >
      <View className="flex-row items-center justify-between gap-2">
        <Text className="font-extrabold text-slate-900 dark:text-white text-[14px]">{c.numero}</Text>
        <Text className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{libelleStatutCommande(c.statut)}</Text>
      </View>
      <Text className="text-[13px] font-bold text-emerald-700 dark:text-emerald-400">{nomPersonne(c.livreur)}</Text>
      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{dateHeure(c.date)}</Text>
      {c.remisesEnAttente > 0 ? (
        <Text className="text-[11px] font-bold text-amber-600 mb-1">
          {c.remisesEnAttente > 1 ? `${c.remisesEnAttente} remises en attente de confirmation` : '1 remise en attente de confirmation'}
        </Text>
      ) : null}
      <TableauQuantites lignes={c.lignes} />
    </Pressable>
  );
}
