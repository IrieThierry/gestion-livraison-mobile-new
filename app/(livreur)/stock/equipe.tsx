import { useMemo, useState } from 'react';
import { ScrollView, View, Text, RefreshControl } from 'react-native';
import { Package } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { SelectField } from '../../../components/shared/SelectField';
import { useStockEquipe } from '../../../features/stock/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';

/**
 * « Stock équipe » — vue du **stock courant** de l'équipe (root + apprentis),
 * cumulé par produit (somme tous fournisseurs). Un filtre permet de zoomer
 * sur un livreur précis ; sans filtre, on additionne tous les livreurs.
 *
 * Source : `GET /stock-livreur/equipe` qui renvoie une ligne par tuple
 * (produit × fournisseur) avec ventilation `parLivreur`.
 */
export default function StockEquipe() {
  const user = useAuthStore((s) => s.user);
  const q = useStockEquipe();
  const [livreurFilter, setLivreurFilter] = useState<string | null>(null);

  // Liste des livreurs ayant du stock (pour le filtre)
  const livreurs = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>();
    for (const l of q.data ?? []) {
      for (const pl of l.parLivreur) {
        if (!map.has(pl.livreurId)) {
          map.set(pl.livreurId, {
            id: pl.livreurId,
            label: `${pl.prenom} ${pl.nom}`.trim(),
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      a.label.localeCompare(b.label, 'fr'),
    );
  }, [q.data]);

  /**
   * Cumul par produit : on agrège toutes les lignes du même produit (peu
   * importe le fournisseur) et on calcule la qté en fonction du filtre
   * livreur (si présent → on prend uniquement la qté de ce livreur, sinon
   * on prend `totalQte`). On agrège aussi la valeur de coût et de vente
   * pour donner une idée de la valorisation.
   */
  const lignesParProduit = useMemo(() => {
    type Agg = {
      produitId: string;
      designation: string;
      code: string;
      qte: number;
      coutTotal: number;
      valeurVenteTotal: number | null;
      // Détail fournisseurs (pour info au tap éventuel plus tard)
      fournisseursLibelles: string[];
    };
    const acc = new Map<string, Agg>();
    for (const ligne of q.data ?? []) {
      const qteLigne =
        livreurFilter == null
          ? ligne.totalQte
          : (ligne.parLivreur.find((p) => p.livreurId === livreurFilter)?.qte ?? 0);
      if (qteLigne === 0) continue;

      // Quand on filtre par livreur, on doit recalculer la valeur (coût et
      // valeurVente) au prorata de la qté affichée pour ne pas montrer la
      // valeur globale équipe sur un sous-ensemble.
      const ratio = ligne.totalQte > 0 ? qteLigne / ligne.totalQte : 0;
      const coutLigne = ligne.coutTotal * ratio;
      const valVenteLigne =
        ligne.valeurVenteTotal != null ? ligne.valeurVenteTotal * ratio : null;

      const existing = acc.get(ligne.produit.id);
      if (!existing) {
        acc.set(ligne.produit.id, {
          produitId: ligne.produit.id,
          designation: ligne.produit.designation,
          code: ligne.produit.code ?? '',
          qte: qteLigne,
          coutTotal: coutLigne,
          valeurVenteTotal: valVenteLigne,
          fournisseursLibelles: ligne.fournisseur
            ? [ligne.fournisseur.libelle]
            : [],
        });
      } else {
        existing.qte += qteLigne;
        existing.coutTotal += coutLigne;
        existing.valeurVenteTotal =
          existing.valeurVenteTotal == null && valVenteLigne == null
            ? null
            : (existing.valeurVenteTotal ?? 0) + (valVenteLigne ?? 0);
        if (
          ligne.fournisseur &&
          !existing.fournisseursLibelles.includes(ligne.fournisseur.libelle)
        ) {
          existing.fournisseursLibelles.push(ligne.fournisseur.libelle);
        }
      }
    }
    return Array.from(acc.values()).sort((a, b) =>
      a.designation.localeCompare(b.designation, 'fr'),
    );
  }, [q.data, livreurFilter]);

  const totals = useMemo(() => {
    const totalQte = lignesParProduit.reduce((acc, l) => acc + l.qte, 0);
    const totalCout = lignesParProduit.reduce((acc, l) => acc + l.coutTotal, 0);
    const totalVente = lignesParProduit.reduce(
      (acc, l) => acc + (l.valeurVenteTotal ?? 0),
      0,
    );
    return { totalQte, totalCout, totalVente };
  }, [lignesParProduit]);

  const livreurFilterLabel =
    livreurFilter == null
      ? 'Toute l’équipe'
      : (livreurs.find((l) => l.id === livreurFilter)?.label ?? '—');

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title="Stock équipe"
        subtitle={`${lignesParProduit.length} produit${lignesParProduit.length > 1 ? 's' : ''} · ${totals.totalQte} unités`}
      />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={q.isFetching && !q.isLoading}
            onRefresh={() => q.refetch()}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4 pt-3">
          {/* Filtre livreur */}
          <SelectField
            label="Filtrer par livreur"
            placeholder="Toute l'équipe"
            value={livreurFilter ?? '__all__'}
            options={[
              { id: '__all__', label: 'Toute l’équipe' },
              ...livreurs.map((l) => ({
                id: l.id,
                label: l.id === user.id ? `${l.label} (toi)` : l.label,
              })),
            ]}
            onChange={(next) =>
              setLivreurFilter(next == null || next === '__all__' ? null : next)
            }
          />

          {/* Carte hero — cumul filtré */}
          <View className="bg-emerald-500 rounded-lg p-4 shadow-md mt-3">
            <Text className="text-[10px] font-semibold uppercase text-white/90">
              Stock courant — {livreurFilterLabel}
            </Text>
            <View className="flex-row items-baseline gap-2 mt-1">
              <Text className="text-3xl font-extrabold text-white">
                {totals.totalQte}
              </Text>
              <Text className="text-sm text-white/90 font-bold">unités</Text>
            </View>
            <View className="flex-row gap-4 mt-2">
              <View>
                <Text className="text-[10px] text-white/70 uppercase">
                  Valeur coût
                </Text>
                <Text className="text-sm font-bold text-white">
                  {formatFCFA(Math.round(totals.totalCout))} F
                </Text>
              </View>
              <View>
                <Text className="text-[10px] text-white/70 uppercase">
                  Valeur vente
                </Text>
                <Text className="text-sm font-bold text-white">
                  {formatFCFA(Math.round(totals.totalVente))} F
                </Text>
              </View>
            </View>
          </View>

          {/* Liste cumulée par produit */}
          {q.isLoading ? (
            <Text className="text-slate-400 text-sm mt-5">Chargement…</Text>
          ) : lignesParProduit.length === 0 ? (
            <View className="mt-5">
              <EmptyState
                title="Stock équipe vide"
                message={
                  livreurFilter == null
                    ? "Aucun membre de l'équipe n'a de stock embarqué actuellement."
                    : 'Ce livreur n’a pas de stock pour le moment.'
                }
              />
            </View>
          ) : (
            <View className="mt-5 gap-2">
              <View className="flex-row items-center gap-1.5 mb-1">
                <Package color="#10b981" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Cumul par produit
                </Text>
              </View>
              {lignesParProduit.map((l) => (
                <View
                  key={l.produitId}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center justify-between"
                >
                  <View className="flex-1 pr-2">
                    <Text className="font-bold text-slate-900 dark:text-white text-[13px]">
                      {l.designation}
                    </Text>
                    <Text className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {l.code ? `${l.code} · ` : ''}
                      {l.fournisseursLibelles.length > 0
                        ? l.fournisseursLibelles.join(', ')
                        : '—'}
                      {l.coutTotal > 0
                        ? ` · ${formatFCFA(Math.round(l.coutTotal))} F`
                        : ''}
                    </Text>
                  </View>
                  <Text className="text-lg font-extrabold text-slate-900 dark:text-white">
                    {l.qte}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
