import { useMemo, useState } from 'react';
import { comparerDesignations } from '../../../lib/tri';
import { ScrollView, View, Text, Pressable, RefreshControl, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SelectField } from '../../../components/shared/SelectField';
import { ProduitVignette } from '../../../components/shared/ProduitVignette';
import { useProduits } from '../../../features/produits/hooks';
import { useMouvementsStock } from '../../../features/stock/hooks';
import { libelleQuantiteMouvement, libelleTypeMouvement } from '../../../features/stock/regles';
import { FiltrePeriode } from '../../../components/shared/FiltrePeriode';
import {
  bornesPeriode,
  derniersJours,
  moisEnCours,
  type OptionPeriode,
  type ValeurPeriode,
} from '../../../lib/periode';
import { useAuthStore } from '../../../stores/authStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatDateLong, formatTime } from '../../../lib/format';

type Raccourci = 'mois' | '30j' | '90j';

/** Raccourcis de période (mois en cours par défaut) ; « Période… » : Du / Au (FiltrePeriode). */
const PERIODES: ReadonlyArray<OptionPeriode<Raccourci>> = [
  { cle: 'mois', label: 'Ce mois', bornes: moisEnCours },
  { cle: '30j', label: '30 jours', bornes: (n) => derniersJours(30, n) },
  { cle: '90j', label: '90 jours', bornes: (n) => derniersJours(90, n) },
];

/**
 * Mouvements de stock du livreur connecté (`GET /stock-livreur/{id}/historique`) :
 * réceptions, transferts reçus et envoyés, livraisons, retours remis en stock.
 * Journal lu à la volée, du plus récent au plus ancien ; quantité signée.
 * Filtres : période (mois en cours par défaut, « Période… » Du / Au) et produit.
 */
export default function MouvementsStock() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const [periode, setPeriode] = useState<ValeurPeriode<Raccourci>>({ cle: 'mois' });
  const [produitId, setProduitId] = useState<string | null>(null);

  const qProduits = useProduits();
  const filtres = useMemo(
    () => ({ ...bornesPeriode(periode, PERIODES), ...(produitId ? { produitId } : {}) }),
    [periode, produitId],
  );
  const q = useMouvementsStock(livreurId, filtres);
  const mouvements = q.data ?? [];

  const produitOptions = useMemo(
    () =>
      [...(qProduits.data ?? [])]
        .sort((a, b) => comparerDesignations(a.designation, b.designation))
        .map((p) => ({ id: p.id, label: p.designation })),
    [qProduits.data],
  );

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Mouvements de stock"
        subtitle={`${mouvements.length} mouvement${mouvements.length > 1 ? 's' : ''}`}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isRefetching}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          <View className="mb-3">
            <FiltrePeriode options={PERIODES} valeur={periode} defaut="mois" onChange={setPeriode} />
          </View>

          <View className="flex-row items-end gap-2">
            <View className="flex-1">
              <SelectField
                label="Produit"
                placeholder="Tous les produits"
                value={produitId}
                onChange={setProduitId}
                options={produitOptions}
                isLoading={qProduits.isLoading}
                emptyMessage="Aucun produit"
                optional
              />
            </View>
            {produitId ? (
              <Pressable
                onPress={() => setProduitId(null)}
                className="bg-slate-100 dark:bg-slate-800 px-3 py-3 rounded-md active:opacity-70 mb-1"
              >
                <X color="#64748b" size={14} />
              </Pressable>
            ) : null}
          </View>

          {q.isLoading ? (
            <View className="mt-6">
              <ActivityIndicator color="#10b981" />
            </View>
          ) : q.isError ? (
            <View className="mt-3">
              <EmptyState
                title="Chargement impossible"
                message={extractApiErrorMessage(q.error, 'Impossible de charger les mouvements.')}
              />
            </View>
          ) : mouvements.length === 0 ? (
            <View className="mt-3">
              <EmptyState
                title="Aucun mouvement"
                message="Aucun mouvement de stock sur cette période."
              />
            </View>
          ) : (
            <View className="gap-2 mt-3">
              {mouvements.map((m, i) => {
                const entree = m.quantite > 0;
                const sortie = m.quantite < 0;
                return (
                  <View
                    key={`${m.date}-${m.type}-${m.produit.id}-${i}`}
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 border-l-4 ${
                      entree ? 'border-l-emerald-500' : sortie ? 'border-l-red-500' : 'border-l-slate-300'
                    } rounded-lg p-3 flex-row items-start justify-between`}
                  >
                    <View className="mr-3">
                      <ProduitVignette
                        designation={m.produit.designation}
                        photoUrl={m.produit.photoUrl}
                        size={36}
                      />
                    </View>
                    <View className="flex-1 pr-2">
                      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                        {libelleTypeMouvement(m.type)} · {formatDateLong(m.date)} {formatTime(m.date)}
                      </Text>
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px] mt-0.5">
                        {m.produit.designation}
                      </Text>
                      {m.type === 'AJUSTEMENT' && m.reference ? (
                        <Text className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                          Motif : {m.reference}
                        </Text>
                      ) : m.reference ? (
                        <Text className="font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {m.reference}
                        </Text>
                      ) : null}
                      {m.contrepartie ? (
                        <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {m.contrepartie}
                        </Text>
                      ) : null}
                    </View>
                    <Text
                      className={`text-xl font-extrabold ${
                        entree
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : sortie
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {libelleQuantiteMouvement(m)}
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
