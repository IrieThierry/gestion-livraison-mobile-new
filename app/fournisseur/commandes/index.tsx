import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SearchInput } from '../../../components/shared/SearchInput';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import { CarteCommandeFournisseur } from '../../../components/fournisseur/CommandeFournisseur';
import { useCommandesFournisseur } from '../../../features/fournisseur/hooks';
import {
  FILTRES_COMMANDES_FOURNISSEUR,
  PERIODES_COMMANDES,
  filtrerCommandes,
  type RaccourciCommandes,
} from '../../../features/fournisseur/gestion';
import type { FiltreStatutCommande } from '../../../features/commandes/regles';
import { bornesPeriode, type ValeurPeriode } from '../../../lib/periode';
import { AUCUN_RESULTAT } from '../../../lib/recherche';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { naviguer } from '../../../lib/navigation-app';

/**
 * F2 : commandes reçues des livreurs partenaires, filtrées par statut,
 * période (date de la commande) et recherche (référence, livreur). Le
 * détail porte les actions (Confirmer, Refuser).
 */
export default function CommandesFournisseur() {
  const q = useCommandesFournisseur();
  const [statut, setStatut] = useState<FiltreStatutCommande>('TOUTES');
  const [periode, setPeriode] = useState<ValeurPeriode<RaccourciCommandes>>({ cle: 'tout' });
  const [recherche, setRecherche] = useState('');

  const visibles = useMemo(
    () => filtrerCommandes(q.data, { statut, bornes: bornesPeriode(periode, PERIODES_COMMANDES), recherche }),
    [q.data, statut, periode, recherche],
  );
  const total = q.data?.length ?? 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Commandes reçues"
        subtitle={`${total} commande${total > 1 ? 's' : ''} · confirme ou refuse ; le livreur réceptionne ensuite`}
        showBack={false}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-12 grow-0"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}
      >
        {FILTRES_COMMANDES_FOURNISSEUR.map((f) => (
          <Pressable
            key={f.valeur}
            onPress={() => setStatut(f.valeur)}
            accessibilityRole="button"
            accessibilityState={{ selected: statut === f.valeur }}
            className={`px-3 py-1.5 rounded-full ${
              statut === f.valeur
                ? 'bg-emerald-700'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Text
              className={`text-[12px] font-bold ${
                statut === f.valeur ? 'text-white' : 'text-slate-700 dark:text-slate-300'
              }`}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View className="px-4 pt-2 gap-2">
        <FiltrePeriode options={PERIODES_COMMANDES} valeur={periode} defaut="tout" onChange={setPeriode} titre={null} />
        <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Référence ou livreur…" />
      </View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={visibles}
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
          ) : recherche.trim() ? (
            <Text className="text-slate-400 dark:text-slate-500 text-sm text-center pt-6">{AUCUN_RESULTAT}</Text>
          ) : (
            <EmptyState
              title="Aucune commande"
              message={total === 0 ? 'Tes livreurs partenaires n’ont encore rien commandé.' : 'Rien à afficher pour ce filtre.'}
            />
          )
        }
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item: c }) => (
          <CarteCommandeFournisseur commande={c} onPress={() => naviguer(`/fournisseur/commandes/${c.id}`)} />
        )}
      />
    </View>
  );
}
