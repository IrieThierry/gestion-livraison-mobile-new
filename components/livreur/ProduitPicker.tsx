import { View, Text, TextInput, Pressable } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
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
  // produit, comme la page web `NouvelleLivraisonPage`.
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

  const remove = (i: number) => onChange(lignes.filter((_, idx) => idx !== i));

  return (
    <View>
      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-2">
        Catalogue
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {catalogue.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => addLigne(item)}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-md flex-row items-center gap-1.5 active:opacity-70"
          >
            <Plus color="#10b981" size={14} />
            <Text className="text-slate-900 dark:text-white text-sm">
              {item.designation}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
        Lignes ({lignes.length})
      </Text>
      <View className="gap-2">
        {lignes.map((l, i) => (
          <View
            key={l.produitId}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
          >
            <View className="flex-1">
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {l.designation}
              </Text>
              <Text className="text-[11px] text-slate-500 dark:text-slate-400">
                {formatFCFA(l.prix)} FCFA × {l.qte} ={' '}
                <Text className="font-semibold">{formatFCFA(l.prix * l.qte)}</Text>
              </Text>
            </View>
            <TextInput
              value={String(l.qte)}
              keyboardType="number-pad"
              onChangeText={(v) => updateQte(i, parseInt(v, 10) || 0)}
              className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-slate-900 dark:text-white"
            />
            <Pressable onPress={() => remove(i)} hitSlop={6} className="active:opacity-60">
              <Trash2 color="#ef4444" size={18} />
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
