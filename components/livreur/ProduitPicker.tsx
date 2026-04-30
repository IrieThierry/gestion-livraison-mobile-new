import { View, Text, TextInput, Pressable } from 'react-native';
import { Plus, Trash2, AlertCircle } from 'lucide-react-native';
import { useProduits } from '../../features/produits/hooks';
import { formatFCFA } from '../../lib/format';
import type { ProduitResponse } from '../../types/api';

export interface Ligne {
  produitId: string;
  designation: string;
  prix: number;
  qte: number;
}

export function ProduitPicker({
  lignes,
  onChange,
  prixDeVenteParDefaut,
}: {
  lignes: Ligne[];
  onChange: (l: Ligne[]) => void;
  // Prix par défaut quand on ajoute une ligne (vient du client choisi via
  // `prixDeVenteProduitParDefault`). Fallback : `prixAchatParDefaut` du
  // produit, comme la page web `NouvelleLivraisonPage`. Si tout vaut 0,
  // l'utilisateur peut éditer le prix directement dans la ligne.
  prixDeVenteParDefaut?: number;
}) {
  const { data: catalogue = [] } = useProduits();

  const addLigne = (item: ProduitResponse) => {
    if (lignes.find((l) => l.produitId === item.id)) return;
    const prix = prixDeVenteParDefaut ?? item.prixAchatParDefaut ?? 0;
    onChange([
      ...lignes,
      { produitId: item.id, designation: item.designation, prix, qte: 1 },
    ]);
  };

  const updateQte = (i: number, qte: number) => {
    const next = [...lignes];
    next[i] = { ...next[i], qte: Math.max(0, qte) };
    onChange(next);
  };

  const updatePrix = (i: number, prix: number) => {
    const next = [...lignes];
    next[i] = { ...next[i], prix: Math.max(0, prix) };
    onChange(next);
  };

  const remove = (i: number) => onChange(lignes.filter((_, idx) => idx !== i));

  return (
    <View>
      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Catalogue
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {catalogue.map((item) => {
          const already = lignes.some((l) => l.produitId === item.id);
          return (
            <Pressable
              key={item.id}
              onPress={() => addLigne(item)}
              disabled={already}
              className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-md flex-row items-center gap-1.5 active:opacity-70 ${
                already
                  ? 'border-emerald-300 dark:border-emerald-800 opacity-50'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <Plus color={already ? '#94a3b8' : '#10b981'} size={14} />
              <Text
                className={`text-sm ${
                  already
                    ? 'text-slate-400 dark:text-slate-500'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.designation}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
        Lignes ({lignes.length})
      </Text>
      <View className="gap-2">
        {lignes.map((l, i) => {
          const sousTotal = l.prix * l.qte;
          const prixZero = l.prix <= 0;
          return (
            <View
              key={l.produitId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3"
            >
              {/* Header: designation + remove */}
              <View className="flex-row items-center justify-between mb-2">
                <Text className="font-extrabold text-slate-900 dark:text-white flex-1 pr-2">
                  {l.designation}
                </Text>
                <Pressable
                  onPress={() => remove(i)}
                  hitSlop={10}
                  className="active:opacity-60 p-1"
                >
                  <Trash2 color="#ef4444" size={18} />
                </Pressable>
              </View>

              {/* Inputs : Prix + Qté */}
              <View className="flex-row gap-2">
                <View className="flex-1">
                  <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Prix unitaire (FCFA)
                  </Text>
                  <TextInput
                    value={l.prix > 0 ? String(l.prix) : ''}
                    onChangeText={(v) =>
                      updatePrix(i, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0)
                    }
                    keyboardType="number-pad"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    className={`px-3 py-2.5 rounded-md text-slate-900 dark:text-white text-base border ${
                      prixZero
                        ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
                    }`}
                  />
                </View>
                <View className="w-24">
                  <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Quantité
                  </Text>
                  <TextInput
                    value={l.qte > 0 ? String(l.qte) : ''}
                    onChangeText={(v) =>
                      updateQte(i, parseInt(v.replace(/[^0-9]/g, ''), 10) || 0)
                    }
                    keyboardType="number-pad"
                    selectTextOnFocus
                    placeholder="0"
                    placeholderTextColor="#94a3b8"
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-center text-slate-900 dark:text-white text-base"
                  />
                </View>
              </View>

              {/* Warn empty price */}
              {prixZero ? (
                <View className="flex-row items-center gap-1.5 mt-2">
                  <AlertCircle color="#ef4444" size={12} />
                  <Text className="text-[11px] text-red-500">
                    Définis un prix unitaire
                  </Text>
                </View>
              ) : null}

              {/* Sous-total */}
              <View className="flex-row justify-between items-center mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                  {formatFCFA(l.prix)} × {l.qte}
                </Text>
                <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatFCFA(sousTotal)} FCFA
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
