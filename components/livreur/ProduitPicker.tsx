import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Plus, Trash2, AlertCircle, Package, Tag, Save } from 'lucide-react-native';
import { useProduits } from '../../features/produits/hooks';
import { useStockCourant } from '../../features/stock/hooks';
import { useResoudrePrix, useUpsertPrixClient } from '../../features/prix/hooks';
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
  clientId,
  enforceStock = false,
  onValidityChange,
}: {
  lignes: Ligne[];
  onChange: (l: Ligne[]) => void;
  // Prix par défaut quand on ajoute une ligne (vient du client choisi via
  // `prixDeVenteProduitParDefault`). Fallback : `prixAchatParDefaut` du
  // produit. Si le résolveur `/prix/resoudre` renvoie un prix mémorisé,
  // il prime sur ce fallback (cf. cascade dans LigneRow).
  prixDeVenteParDefaut?: number;
  // Si fourni, chaque ligne appelle `/prix/resoudre?clientId=X&produitId=Y`
  // et auto-remplit le prix avec le prix mémorisé. Mirror du web
  // `LigneProduitsField` qui passe par `useResoudrePrix` par ligne.
  clientId?: string;
  // Quand true, on lit le `stock_courant_livreur` et on met en évidence
  // les lignes dont la quantité dépasse le stock dispo. Activé sur l'écran
  // « Nouvelle livraison ». Inactif sur « Déclarer un achat » (achat
  // = entrée de stock, le concept de stock dispo n'a pas de sens).
  enforceStock?: boolean;
  // Notifie le parent quand au moins une ligne dépasse le stock dispo,
  // pour qu'il puisse désactiver son bouton « Enregistrer ».
  onValidityChange?: (insufficientLignes: number) => void;
}) {
  const { data: catalogue = [] } = useProduits();
  const stockQ = useStockCourant();

  // Map produitId → qteVendable pour lookup O(1) sur chaque ligne
  const stockMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of stockQ.data ?? []) {
      if (s.produit?.id) m.set(s.produit.id, s.qteVendable ?? 0);
    }
    return m;
  }, [stockQ.data]);

  const insufficientLignes = useMemo(() => {
    if (!enforceStock) return 0;
    return lignes.reduce((acc, l) => {
      const dispo = stockMap.get(l.produitId) ?? 0;
      return acc + (l.qte > dispo ? 1 : 0);
    }, 0);
  }, [enforceStock, lignes, stockMap]);

  // Bubble up changes whenever insufficientLignes changes
  useEffect(() => {
    onValidityChange?.(insufficientLignes);
  }, [insufficientLignes, onValidityChange]);

  const addLigne = (item: ProduitResponse) => {
    if (lignes.find((l) => l.produitId === item.id)) return;
    const prix = prixDeVenteParDefaut ?? item.prixAchatParDefaut ?? 0;
    onChange([
      ...lignes,
      { produitId: item.id, designation: item.designation, prix, qte: 1 },
    ]);
  };

  const updateAt = (i: number, patch: Partial<Ligne>) => {
    const next = [...lignes];
    next[i] = { ...next[i], ...patch };
    if (patch.qte !== undefined) next[i].qte = Math.max(0, next[i].qte);
    if (patch.prix !== undefined) next[i].prix = Math.max(0, next[i].prix);
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
          // Si on enforce le stock, montrer en filigrane les produits qui
          // n'ont pas de stock embarqué (impossible à livrer aujourd'hui)
          const stockDispo = stockMap.get(item.id) ?? 0;
          const noStock = enforceStock && stockDispo === 0 && !already;
          return (
            <Pressable
              key={item.id}
              onPress={() => addLigne(item)}
              disabled={already}
              className={`bg-white dark:bg-slate-900 border px-3 py-2 rounded-md flex-row items-center gap-1.5 active:opacity-70 ${
                already
                  ? 'border-emerald-300 dark:border-emerald-800 opacity-50'
                  : noStock
                  ? 'border-red-300 dark:border-red-800 opacity-60'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            >
              <Plus
                color={already ? '#94a3b8' : noStock ? '#ef4444' : '#10b981'}
                size={14}
              />
              <Text
                className={`text-sm ${
                  already
                    ? 'text-slate-400 dark:text-slate-500'
                    : noStock
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-slate-900 dark:text-white'
                }`}
              >
                {item.designation}
              </Text>
              {enforceStock && !already ? (
                <Text
                  className={`text-[10px] font-mono ${
                    noStock
                      ? 'text-red-500'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  · {stockDispo}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
        Lignes ({lignes.length})
      </Text>
      <View className="gap-2">
        {lignes.map((l, i) => (
          <LigneRow
            key={l.produitId}
            line={l}
            clientId={clientId}
            stockDispo={stockMap.get(l.produitId) ?? 0}
            enforceStock={enforceStock}
            onUpdate={(patch) => updateAt(i, patch)}
            onRemove={() => remove(i)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Sous-composant ligne. Appelle le résolveur de prix
 * `useResoudrePrix(clientId, produitId)` pour chaque (client, produit) et
 * pré-remplit `line.prix` avec le prix mémorisé si dispo. Affiche un badge
 * indiquant la source du prix (« Prix client » / « Prix livreur ») et
 * propose un bouton « Mémoriser » si le livreur a saisi un prix différent
 * du prix résolu.
 */
function LigneRow({
  line,
  clientId,
  stockDispo,
  enforceStock,
  onUpdate,
  onRemove,
}: {
  line: Ligne;
  clientId?: string;
  stockDispo: number;
  enforceStock: boolean;
  onUpdate: (patch: Partial<Ligne>) => void;
  onRemove: () => void;
}) {
  const { data: resolved } = useResoudrePrix(clientId, line.produitId);
  const memorise = useUpsertPrixClient();

  // Track le dernier prix résolu pour comparer au prix actuel et savoir
  // s'il a été modifié manuellement (cas où on doit afficher le bouton
  // « Mémoriser »).
  const [resolvedPrix, setResolvedPrix] = useState<number | null>(null);
  const lastQueryKey = useRef<string>('');

  useEffect(() => {
    if (!resolved) return;
    const queryKey = `${clientId ?? ''}__${line.produitId}`;
    // Quand le résolveur répond pour un nouveau (client, produit) :
    //   - on met à jour le prix de la ligne avec le prix mémorisé si présent
    //   - on stocke le prix résolu pour comparer plus tard
    if (lastQueryKey.current !== queryKey) {
      lastQueryKey.current = queryKey;
      if (resolved.prix !== null && resolved.prix > 0) {
        onUpdate({ prix: resolved.prix });
      }
      setResolvedPrix(resolved.prix);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, clientId, line.produitId]);

  const sousTotal = line.prix * line.qte;
  const prixZero = line.prix <= 0;
  const stockInsuffisant = enforceStock && line.qte > stockDispo;
  const prixModifie =
    resolvedPrix !== null && line.prix > 0 && line.prix !== resolvedPrix;

  const onMemoriser = () => {
    if (!clientId) return;
    memorise.mutate({ clientId, produitId: line.produitId, prix: line.prix });
  };

  return (
    <View
      className={`bg-white dark:bg-slate-900 border rounded-md p-3 ${
        stockInsuffisant
          ? 'border-red-300 dark:border-red-700'
          : 'border-slate-200 dark:border-slate-800'
      }`}
    >
      {/* Header: designation + remove */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-extrabold text-slate-900 dark:text-white flex-1 pr-2">
          {line.designation}
        </Text>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          className="active:opacity-60 p-1"
        >
          <Trash2 color="#ef4444" size={18} />
        </Pressable>
      </View>

      {/* Source du prix résolu */}
      {resolved?.source ? (
        <View className="flex-row items-center gap-1 mb-2">
          <Tag color="#059669" size={11} />
          <Text className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">
            {resolved.source === 'CLIENT'
              ? 'Prix mémorisé pour ce client'
              : 'Prix par défaut livreur'}
            {resolvedPrix !== null ? ` · ${formatFCFA(resolvedPrix)} FCFA` : ''}
          </Text>
        </View>
      ) : null}

      {/* Inputs : Prix + Qté */}
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Prix unitaire (FCFA)
          </Text>
          <TextInput
            value={line.prix > 0 ? String(line.prix) : ''}
            onChangeText={(v) =>
              onUpdate({
                prix: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
              })
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
            value={line.qte > 0 ? String(line.qte) : ''}
            onChangeText={(v) =>
              onUpdate({
                qte: parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
              })
            }
            keyboardType="number-pad"
            selectTextOnFocus
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className={`px-3 py-2.5 border rounded-md text-center text-slate-900 dark:text-white text-base ${
              stockInsuffisant
                ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
            }`}
          />
        </View>
      </View>

      {/* Bouton mémoriser le nouveau prix client */}
      {prixModifie && clientId ? (
        <Pressable
          onPress={onMemoriser}
          disabled={memorise.isPending}
          className="flex-row items-center gap-1.5 mt-2 self-start bg-emerald-100 dark:bg-emerald-500/15 px-2.5 py-1.5 rounded-md active:opacity-70"
        >
          <Save color="#059669" size={12} />
          <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
            {memorise.isPending
              ? 'Enregistrement…'
              : memorise.isSuccess
              ? '✓ Mémorisé'
              : `Mémoriser ${formatFCFA(line.prix)} pour ce client`}
          </Text>
        </Pressable>
      ) : null}

      {/* Stock badge / warning ligne */}
      {enforceStock ? (
        <View className="flex-row items-center gap-1.5 mt-2">
          <Package
            color={stockInsuffisant ? '#ef4444' : '#64748b'}
            size={12}
          />
          <Text
            className={`text-[11px] ${
              stockInsuffisant
                ? 'text-red-500 font-bold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Stock dispo : {stockDispo}
          </Text>
          {stockInsuffisant ? (
            <>
              <Text className="text-[11px] text-red-500"> · </Text>
              <AlertCircle color="#ef4444" size={12} />
              <Text className="text-[11px] text-red-500 font-bold">
                Stock insuffisant
              </Text>
            </>
          ) : null}
        </View>
      ) : null}

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
          {formatFCFA(line.prix)} × {line.qte}
        </Text>
        <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatFCFA(sousTotal)} FCFA
        </Text>
      </View>
    </View>
  );
}
