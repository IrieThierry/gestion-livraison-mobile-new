import { useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import {
  RotateCcw,
  User,
  Package,
  ArrowRight,
  X,
} from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SelectField } from '../../../components/shared/SelectField';
import { SearchInput } from '../../../components/shared/SearchInput';
import { AUCUN_RESULTAT, filtrerRecherche } from '../../../lib/recherche';
import { useClientsByLivreur, useEncoursByLivreur } from '../../../features/clients/hooks';
import { optionsClients, soldesParClient } from '../../../features/clients/affichage';
import { useRetours } from '../../../features/retours/hooks';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import {
  bornesPeriode,
  derniersJours,
  moisEnCours,
  type OptionPeriode,
  type ValeurPeriode,
} from '../../../lib/periode';
import {
  libelleDestination,
  libelleOrigine,
  libelleQuantite,
  libelleValeur,
} from '../../../features/retours/libelles';
import { useProduits } from '../../../features/produits/hooks';
import { TotalRetoursProduits } from '../../../components/livreur/TotalRetoursProduits';
import { useAuthStore } from '../../../stores/authStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateShort } from '../../../lib/format';
import { naviguer } from '../../../lib/navigation-app';

type Raccourci = 'mois' | '30j' | '90j';

/** Raccourcis de période (mois en cours par défaut) ; « Période… » : Du / Au (FiltrePeriode). */
const PERIODES: ReadonlyArray<OptionPeriode<Raccourci>> = [
  { cle: 'mois', label: 'Ce mois', bornes: moisEnCours },
  { cle: '30j', label: '30 jours', bornes: (n) => derniersJours(30, n) },
  { cle: '90j', label: '90 jours', bornes: (n) => derniersJours(90, n) },
];

/**
 * Journal des retours client (`GET /retour`, trié du plus récent au plus
 * ancien par le serveur, paginé).
 *
 * Filtres :
 *   - Période (mois en cours par défaut, 30 / 90 jours, « Période… » Du / Au)
 *   - Client (dropdown, optionnel) — pré-rempli avec `?clientId=X`
 *
 * Une correction (quantité négative) s'affiche « Correction −n ». Au-dessus de
 * la liste, « Total par produit » des retours affichés (`totalRetoursParProduit`).
 */
export default function RetoursList() {
  const params = useLocalSearchParams<{ clientId?: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const qCli = useClientsByLivreur(livreurId);
  const qEncours = useEncoursByLivreur(livreurId);

  const [periode, setPeriode] = useState<ValeurPeriode<Raccourci>>({ cle: 'mois' });
  const [clientFilter, setClientFilter] = useState<string | null>(
    params.clientId ?? null,
  );

  const filtres = useMemo(
    () => ({ ...bornesPeriode(periode, PERIODES), ...(clientFilter ? { clientId: clientFilter } : {}) }),
    [periode, clientFilter],
  );
  const q = useRetours(filtres);
  const retours = useMemo(() => (q.data?.pages ?? []).flatMap((p) => p.contenu), [q.data]);
  const total = q.data?.pages[0]?.total ?? 0;
  // Recherche locale sur les retours chargés : client, produit, réf. livraison.
  const [recherche, setRecherche] = useState('');
  const retoursAffiches = useMemo(
    () =>
      filtrerRecherche(retours, recherche, (r) => [
        r.client.nom,
        r.produit.designation,
        r.livraison.reference,
      ]),
    [retours, recherche],
  );

  // Photos du référentiel pour les vignettes du total par produit.
  const qProduits = useProduits();
  const photos = useMemo(
    () => new Map((qProduits.data ?? []).map((p) => [p.id, p.photoUrl] as const)),
    [qProduits.data],
  );

  const clientOptions = useMemo(
    () =>
      // Ordre alphabétique renvoyé par le back.
      optionsClients(qCli.data ?? [], soldesParClient(qEncours.data)),
    [qCli.data, qEncours.data],
  );

  const clientLabel = clientFilter
    ? clientOptions.find((c) => c.id === clientFilter)?.label ?? 'Client'
    : null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Retours produits"
        subtitle={clientLabel ?? 'Tous clients'}
        right={
          <Pressable
            onPress={() => naviguer('/(livreur)/cash/retour-client')}
            className="bg-emerald-500 px-3 py-1.5 rounded-md flex-row items-center gap-1 active:opacity-80"
          >
            <RotateCcw color="#fff" size={13} />
            <Text className="text-white text-xs font-bold">Nouveau</Text>
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching && !q.isFetchingNextPage}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Filtres */}
          <View className="mb-3">
            <FiltrePeriode options={PERIODES} valeur={periode} defaut="mois" onChange={setPeriode} />
          </View>

          {/* Filtre client (dropdown + clear si filtré) */}
          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <SelectField
                label="Client"
                placeholder="Tous les clients"
                value={clientFilter}
                onChange={setClientFilter}
                options={clientOptions}
                isLoading={qCli.isLoading}
                emptyMessage="Aucun client"
                optional
              />
            </View>
            {clientFilter ? (
              <Pressable
                onPress={() => setClientFilter(null)}
                className="bg-slate-100 dark:bg-slate-800 px-3 py-3 rounded-md active:opacity-70 mb-1"
              >
                <X color="#64748b" size={14} />
              </Pressable>
            ) : null}
          </View>

          <SearchInput
            value={recherche}
            onChangeText={setRecherche}
            placeholder="Client, produit, réf. livraison…"
            className="mt-3"
          />

          {/* Liste */}
          {q.isLoading ? (
            <View className="mt-6">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : q.isError ? (
            <View className="mt-3">
              <EmptyState
                title="Chargement impossible"
                message={extractApiErrorMessage(q.error, 'Impossible de charger les retours.')}
              />
            </View>
          ) : retours.length === 0 ? (
            <View className="mt-3">
              <EmptyState
                title="Aucun retour"
                message={
                  clientFilter
                    ? `Aucun retour pour ${clientLabel} sur cette période.`
                    : 'Aucun retour enregistré sur cette période.'
                }
              />
            </View>
          ) : (
            <>
            <TotalRetoursProduits
              retours={retoursAffiches}
              photos={photos}
              pageSeulement={!!q.hasNextPage}
            />
            <View className="gap-2 mt-3">
              {retoursAffiches.length === 0 ? (
                <Text className="text-[12px] text-slate-400 dark:text-slate-500 text-center py-4">
                  {AUCUN_RESULTAT}
                </Text>
              ) : null}
              {retoursAffiches.map((r) => {
                const correction = r.quantite < 0;
                return (
                  <Pressable
                    key={r.id}
                    onPress={() =>
                      naviguer('/(livreur)/livraisons/[id]', { id: r.livraison.id })
                    }
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 rounded-md p-3 flex-row items-center gap-3 active:opacity-70 ${
                      correction ? 'border-l-slate-400' : 'border-l-amber-500'
                    }`}
                  >
                    <View className="flex-1">
                      <View className="flex-row items-center gap-1.5">
                        <Package color="#64748b" size={11} />
                        <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                          {r.produit.designation}{' '}
                          · {libelleQuantite(r.quantite)}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-1.5 mt-0.5">
                        <User color="#94a3b8" size={10} />
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                          {r.client.nom ?? '—'} · {r.livraison.reference}
                        </Text>
                      </View>
                      <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {formatDateShort(r.dateRetour)} · {r.livreur.nom ?? '—'}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {libelleDestination(r.remisEnStock)} · {libelleOrigine(r.origine)}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="font-extrabold text-slate-700 dark:text-slate-300">
                        {libelleValeur(r.valeur)}
                      </Text>
                      <Text className="text-[9px] text-slate-400 dark:text-slate-500">
                        FCFA
                      </Text>
                    </View>
                    <ArrowRight color="#94a3b8" size={14} />
                  </Pressable>
                );
              })}

              {q.hasNextPage ? (
                <Pressable
                  onPress={() => q.fetchNextPage()}
                  disabled={q.isFetchingNextPage}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md py-3 items-center active:opacity-70"
                >
                  {q.isFetchingNextPage ? (
                    <ActivityIndicator color="#10b981" />
                  ) : (
                    <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                      Charger plus ({retours.length} / {total})
                    </Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
