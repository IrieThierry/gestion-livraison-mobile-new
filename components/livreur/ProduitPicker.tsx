import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Plus, Trash2, AlertCircle, Package, Tag, Save } from 'lucide-react-native';
import { useProduits } from '../../features/produits/hooks';
import { useStockCourant } from '../../features/stock/hooks';
import { useResoudrePrix } from '../../features/prix/hooks';
import { parseRemiseUnitaire } from '../../features/remise/regles';
import { montantLigneEstime, type LigneSaisie } from '../../features/livraisons/regles';
import { formatFCFA } from '../../lib/format';
import type { ProduitResponse } from '../../types/api';

export type Ligne = LigneSaisie;

export function ProduitPicker({
  lignes,
  onChange,
  prixDeVenteParDefaut,
  clientId,
  enforceStock = false,
  onValidityChange,
  avecRemise = false,
  remisesConvenues,
  remiseModifiable = true,
  memoriserPossible = true,
}: {
  lignes: Ligne[];
  onChange: (l: Ligne[]) => void;
  prixDeVenteParDefaut?: number;
  clientId?: string;
  enforceStock?: boolean;
  onValidityChange?: (insufficientLignes: number) => void;
  /** Client avec remise : affiche la remise unitaire par ligne. */
  avecRemise?: boolean;
  /** Remises convenues (produitId → remise) ; undefined tant que non chargées. */
  remisesConvenues?: Map<string, number>;
  /** Faux (apprenti, D14) : remise convenue affichée sans champ éditable. */
  remiseModifiable?: boolean;
  /** Faux (apprenti, D20) : option « Mémoriser le prix » masquée. */
  memoriserPossible?: boolean;
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
    const courantes = lignesRef.current;
    if (courantes.find((l) => l.produitId === item.id)) return;
    const prix = prixDeVenteParDefaut ?? item.prixAchatParDefaut ?? 0;
    const next = [
      ...courantes,
      { produitId: item.id, designation: item.designation, prix, qte: 1 },
    ];
    lignesRef.current = next;
    onChange(next);
  };

  // Dernières lignes connues : plusieurs mises à jour dans le même tick
  // (pré-remplissage du prix ET de la remise, plusieurs lignes à la fois)
  // s'accumulent au lieu de s'écraser avec une copie périmée de `lignes`.
  const lignesRef = useRef(lignes);
  lignesRef.current = lignes;

  const updateProduit = (produitId: string, patch: Partial<Ligne>) => {
    const next = lignesRef.current.map((l) => {
      if (l.produitId !== produitId) return l;
      const maj = { ...l, ...patch };
      if (patch.qte !== undefined) maj.qte = Math.max(0, maj.qte);
      if (patch.prix !== undefined) maj.prix = Math.max(0, maj.prix);
      return maj;
    });
    lignesRef.current = next;
    onChange(next);
  };

  const removeProduit = (produitId: string) => {
    const next = lignesRef.current.filter((l) => l.produitId !== produitId);
    lignesRef.current = next;
    onChange(next);
  };

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
        {lignes.map((l) => (
          <LigneRow
            key={l.produitId}
            line={l}
            clientId={clientId}
            stockDispo={stockMap.get(l.produitId) ?? 0}
            enforceStock={enforceStock}
            avecRemise={avecRemise}
            remisesConvenues={remisesConvenues}
            remiseModifiable={remiseModifiable}
            memoriserPossible={memoriserPossible}
            onUpdate={(patch) => updateProduit(l.produitId, patch)}
            onRemove={() => removeProduit(l.produitId)}
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
 * propose l'option « Mémoriser » si le livreur a saisi un prix différent
 * du prix résolu : le choix est envoyé avec la livraison
 * (`memoriserPrixClient`), le back mémorise le prix dans la même transaction.
 *
 * Client avec remise : la remise unitaire est pré-remplie depuis la remise
 * convenue (0 sans valeur convenue) pour l'affichage et l'estimation ; elle
 * n'est envoyée en `remiseUnitaire` que si le livreur la saisit (le back la
 * mémorise : la dernière saisie gagne).
 */
function LigneRow({
  line,
  clientId,
  stockDispo,
  enforceStock,
  avecRemise,
  remisesConvenues,
  remiseModifiable,
  memoriserPossible,
  onUpdate,
  onRemove,
}: {
  line: Ligne;
  clientId?: string;
  stockDispo: number;
  enforceStock: boolean;
  avecRemise: boolean;
  remisesConvenues?: Map<string, number>;
  remiseModifiable: boolean;
  memoriserPossible: boolean;
  onUpdate: (patch: Partial<Ligne>) => void;
  onRemove: () => void;
}) {
  const { data: resolved } = useResoudrePrix(clientId, line.produitId);

  // Pré-remplissage de la remise dès que les remises convenues sont connues.
  // Tant qu'elles ne le sont pas (hors-ligne sans cache), `remise` reste
  // undefined : rien n'est envoyé et le back applique la remise convenue.
  useEffect(() => {
    if (!avecRemise || line.remiseSaisie || line.remise !== undefined || !remisesConvenues) return;
    onUpdate({ remise: remisesConvenues.get(line.produitId) ?? 0, remiseInvalide: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avecRemise, remisesConvenues, line.remise, line.remiseSaisie, line.produitId]);

  // Texte saisi pour la remise (null = afficher la valeur de la ligne).
  const [remiseTexte, setRemiseTexte] = useState<string | null>(null);
  useEffect(() => {
    setRemiseTexte(null);
  }, [clientId]);

  // Seule une remise saisie (`remiseSaisie`) est envoyée. Champ vidé = pas de
  // saisie : retour à l'affichage pré-rempli (remise convenue), rien n'est
  // envoyé. « 0 » est une saisie valide.
  const onChangeRemise = (v: string) => {
    if (v.trim() === '') {
      setRemiseTexte(null);
      onUpdate({ remise: undefined, remiseSaisie: false, remiseInvalide: false });
      return;
    }
    setRemiseTexte(v);
    const r = parseRemiseUnitaire(v);
    if (r.ok) onUpdate({ remise: r.valeur, remiseSaisie: true, remiseInvalide: false });
    else onUpdate({ remiseSaisie: true, remiseInvalide: true });
  };

  // Track le dernier prix résolu pour comparer au prix actuel et savoir
  // s'il a été modifié manuellement (cas où on doit afficher le bouton
  // « Mémoriser »).
  const [resolvedPrix, setResolvedPrix] = useState<number | null>(null);
  // Vrai dès que le résolveur a répondu pour ce (client, produit), même s'il
  // n'a trouvé aucun prix (prix === null) — permet de proposer « Mémoriser »
  // dès la première saisie.
  const [resolvedLoaded, setResolvedLoaded] = useState(false);
  const lastQueryKey = useRef<string>('');

  useEffect(() => {
    if (!resolved) {
      setResolvedLoaded(false);
      return;
    }
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
      setResolvedLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolved, clientId, line.produitId]);

  const remiseLigne = avecRemise ? line.remise ?? 0 : 0;
  const sousTotal = montantLigneEstime(line.prix, remiseLigne, line.qte);
  const prixZero = line.prix <= 0;
  const stockInsuffisant = enforceStock && line.qte > stockDispo;
  // « Mémoriser » est proposé si le prix saisi diffère du prix résolu, ou
  // s'il n'existe encore aucun prix pour ce client (premier prix saisi).
  const prixModifie =
    !!clientId &&
    resolvedLoaded &&
    line.prix > 0 &&
    (resolvedPrix === null || line.prix !== resolvedPrix);

  // Option désactivée si le prix revient au prix résolu (rien à mémoriser).
  useEffect(() => {
    if (!prixModifie && line.memoriserPrix) onUpdate({ memoriserPrix: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prixModifie, line.memoriserPrix]);

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

      {/* Remise unitaire (client avec remise uniquement) */}
      {avecRemise ? (
        <View className="mt-2">
          <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Remise unitaire (FCFA)
          </Text>
          {!remiseModifiable ? (
            <View className="px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/60 flex-row items-center justify-between">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">Remise convenue</Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {line.remise !== undefined
                  ? `${line.remise.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`
                  : 'Appliquée par le serveur'}
              </Text>
            </View>
          ) : (
          <TextInput
            value={
              remiseTexte ?? (line.remise !== undefined ? String(line.remise) : '')
            }
            onChangeText={onChangeRemise}
            keyboardType="decimal-pad"
            selectTextOnFocus
            placeholder="Remise convenue"
            placeholderTextColor="#94a3b8"
            className={`px-3 py-2.5 rounded-md text-slate-900 dark:text-white text-base border ${
              line.remiseInvalide
                ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'
            }`}
          />
          )}
          {remiseModifiable && line.remiseInvalide ? (
            <Text className="text-[11px] text-red-500 mt-1">
              Remise invalide (nombre positif, 2 décimales maximum)
            </Text>
          ) : remiseModifiable && !remisesConvenues && !line.remiseSaisie ? (
            <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Remise convenue appliquée par le serveur
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Option : mémoriser le prix saisi pour ce client (envoyé avec la livraison) */}
      {prixModifie && memoriserPossible ? (
        <Pressable
          onPress={() => onUpdate({ memoriserPrix: !line.memoriserPrix })}
          className={`flex-row items-center gap-1.5 mt-2 self-start px-2.5 py-1.5 rounded-md active:opacity-70 ${
            line.memoriserPrix
              ? 'bg-emerald-500'
              : 'bg-emerald-100 dark:bg-emerald-500/15'
          }`}
        >
          <Save color={line.memoriserPrix ? '#fff' : '#059669'} size={12} />
          <Text
            className={`text-[11px] font-bold ${
              line.memoriserPrix ? 'text-white' : 'text-emerald-700 dark:text-emerald-400'
            }`}
          >
            {line.memoriserPrix
              ? `✓ ${formatFCFA(line.prix)} sera mémorisé pour ce client`
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
          {avecRemise && remiseLigne > 0
            ? `(${formatFCFA(line.prix)} + ${formatFCFA(remiseLigne)}) × ${line.qte} · estimation`
            : `${formatFCFA(line.prix)} × ${line.qte}${clientId ? ' · estimation' : ''}`}
        </Text>
        <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
          {formatFCFA(sousTotal)} FCFA
        </Text>
      </View>
    </View>
  );
}
