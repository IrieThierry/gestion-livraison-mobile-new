import { useMemo, useState } from 'react';
import { ScrollView, View, Text, Pressable, RefreshControl } from 'react-native';
import { Banknote } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SearchInput } from '../../../components/shared/SearchInput';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { listeEncaissements, nomClientEncaissement } from '../../../features/encaissements/liste';
import { useAuthStore } from '../../../stores/authStore';
import { AUCUN_RESULTAT } from '../../../lib/recherche';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort, formatMontant } from '../../../lib/format';
import { ouvrir } from '../../../lib/navigation-app';

/**
 * « Mes encaissements » — encaissements du livreur connecté (même source que
 * l'ancien écran Cash : `GET /encaissement/livraison/livreur/{id}`), du plus
 * récent au plus ancien, recherche (client, référence), total de la liste.
 *
 * « Encaisser » : l'encaissement se fait pour un client ou une livraison ; le
 * bouton ouvre la liste des livraisons, comme l'action « Encaisser » de
 * l'Accueil. Retour : Accueil (liste, lib/navigation).
 */
export default function MesEncaissements() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const q = useEncaissementsByLivreur(livreurId);
  const [recherche, setRecherche] = useState('');

  const { lignes, total } = useMemo(() => listeEncaissements(q.data ?? [], recherche), [q.data, recherche]);

  if (!user) return null;

  const nb = lignes.length;
  const aucun = (q.data ?? []).length === 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mes encaissements"
        subtitle={`${nb} encaissement${nb > 1 ? 's' : ''} · ${formatMontant(total)} FCFA`}
        right={
          <Pressable
            onPress={() => ouvrir('/(livreur)/livraisons')}
            accessibilityRole="button"
            accessibilityLabel="Encaisser"
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <Banknote color="#fff" size={13} />
            <Text className="text-white text-xs font-bold">Encaisser</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          <SearchInput value={recherche} onChangeText={setRecherche} placeholder="Client, référence…" />

          {!aucun ? (
            <View className="bg-emerald-500 rounded-lg p-4 mt-3">
              <Text className="text-[10px] font-semibold uppercase text-white/90">Total de la liste</Text>
              <Text accessibilityLabel={`Total : ${formatMontant(total)} FCFA`} className="text-2xl font-extrabold text-white mt-1">
                {formatMontant(total)} <Text className="text-base">FCFA</Text>
              </Text>
              <Text className="text-[11px] text-white/85 mt-1">
                {nb} encaissement{nb > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}

          {q.isLoading ? (
            <Text className="text-slate-400 text-sm mt-4">Chargement…</Text>
          ) : q.isError ? (
            <View className="mt-3">
              <EmptyState
                title="Chargement impossible"
                message={extractApiErrorMessage(q.error, 'Impossible de charger les encaissements.')}
              />
            </View>
          ) : aucun ? (
            <View className="mt-3">
              <EmptyState
                title="Aucun encaissement"
                message="Encaisse une livraison avec le bouton « Encaisser »."
              />
            </View>
          ) : nb === 0 ? (
            <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">{AUCUN_RESULTAT}</Text>
          ) : (
            <View className="gap-2 mt-3">
              {lignes.map((e) => {
                const client = nomClientEncaissement(e);
                return (
                  <View
                    key={e.id ?? e.reference}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 border-l-emerald-500 rounded-lg p-3 flex-row items-center justify-between"
                  >
                    <View className="flex-1 pr-2">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {client || 'Encaissement'}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {e.reference}
                        {e.dateEncaissement ? ` · ${formatDateShort(e.dateEncaissement)}` : ''}
                        {e.commentaire ? ` · ${e.commentaire}` : ''}
                      </Text>
                    </View>
                    <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                      {formatMontant(e.montantEncaisse)} F
                    </Text>
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
