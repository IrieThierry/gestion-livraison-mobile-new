import { useMemo } from 'react';
import { View, Text } from 'react-native';
import { ProduitVignette } from '../shared/ProduitVignette';
import { totalRetoursParProduit } from '../../features/retours/totaux';
import { formatMontant } from '../../lib/format';
import type { RetourResponse } from '../../types/api';

/**
 * Bloc « Total par produit » au-dessus du journal des retours : une ligne par
 * produit (vignette, désignation, quantité nette, répartition remis en stock /
 * perdu) pour les retours affichés. Rien si la liste est vide.
 */
export function TotalRetoursProduits({
  retours,
  photos,
  pageSeulement,
}: {
  /** Retours affichés (après période, filtre client et recherche). */
  retours: readonly RetourResponse[];
  /** Photos du référentiel par produit (le journal ne porte que l'id et la désignation). */
  photos: ReadonlyMap<string, string | null | undefined>;
  /** Vrai s'il reste des pages à charger : le total ne porte que sur les retours chargés. */
  pageSeulement?: boolean;
}) {
  const lignes = useMemo(() => totalRetoursParProduit(retours), [retours]);
  if (lignes.length === 0) return null;
  return (
    <View
      accessibilityLabel="Total par produit"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-3"
    >
      <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
        Total par produit
      </Text>
      {pageSeulement ? (
        <Text className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
          Calculé sur les retours chargés.
        </Text>
      ) : null}
      <View className="mt-1">
        {lignes.map((l, i) => (
          <View
            key={l.produitId}
            className={`flex-row items-center gap-2 py-1.5 ${
              i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
            }`}
          >
            <ProduitVignette designation={l.designation} photoUrl={photos.get(l.produitId)} size={28} />
            <View className="flex-1">
              <Text className="font-bold text-slate-900 dark:text-white text-[13px]" numberOfLines={1}>
                {l.designation}
              </Text>
              <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                Remis en stock {formatMontant(l.remisEnStock)} · Perdu {formatMontant(l.perdu)}
              </Text>
            </View>
            <Text
              accessibilityLabel={`Quantité retournée ${l.designation} : ${l.quantite}`}
              className="font-extrabold text-slate-900 dark:text-white"
            >
              {formatMontant(l.quantite)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
