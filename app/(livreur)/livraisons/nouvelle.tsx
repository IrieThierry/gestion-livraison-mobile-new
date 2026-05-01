import { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Package, AlertCircle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ClientPicker } from '../../../components/livreur/ClientPicker';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import {
  useCreerLivraison,
  useLivraisonsByLivreur,
} from '../../../features/livraisons/hooks';
import { useEnregistrerRetour } from '../../../features/retours/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { clientKeys } from '../../../features/clients/keys';
import { produitKeys } from '../../../features/produits/keys';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA, formatDateShort } from '../../../lib/format';
import type {
  ClientResponse,
  CreerLivraisonRequest,
  LivraisonResponse,
} from '../../../types/api';

/**
 * Formulaire de nouvelle livraison.
 *
 * Le formulaire affiche en plus une section « Retours en attente » qui
 * liste, pour le client choisi, les produits-livraison passés où il
 * reste de la quantité retournable (`qteLivree − qteRetournee > 0`).
 * Le livreur peut saisir une quantité à retourner par ligne. À la
 * soumission :
 *  1. La nouvelle livraison est créée (existant)
 *  2. Pour chaque livraison passée avec au moins une ligne retournée
 *     > 0, on appelle `useEnregistrerRetour` (PUT /livraison)
 *
 * Les retours sont distincts de la quantité livrée du jour — ils
 * agissent sur des livraisons antérieures (le back ré-incrémente le
 * stock et déduit du solde client à part).
 */
export default function NouvelleLivraison() {
  const user = useAuthStore((s) => s.user);
  const { clientId: prefilledClientId } = useLocalSearchParams<{ clientId?: string }>();
  const clientsQ = useClientsByLivreur(user?.id ?? '');
  const livraisonsQ = useLivraisonsByLivreur(user?.id ?? '');
  const clientsData = clientsQ.data ?? [];
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  // Map produitLivraisonId → qte à retourner (saisie par le livreur)
  const [retoursAttente, setRetoursAttente] = useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [insufficientCount, setInsufficientCount] = useState(0);
  const total = lignes.reduce((acc, l) => acc + l.prix * l.qte, 0);
  const m = useCreerLivraison();
  const mRetour = useEnregistrerRetour();
  const qc = useQueryClient();

  // Pull-to-refresh : invalide les lookups dont le formulaire dépend
  // (clients du livreur + catalogue produits) pour récupérer immédiatement
  // ce qui aurait été créé sur le portail web pendant que ce form est ouvert.
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.invalidateQueries({ queryKey: clientKeys.all }),
        qc.invalidateQueries({ queryKey: produitKeys.all }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Pre-select client if arriving from the client list with ?clientId=…
  useEffect(() => {
    if (prefilledClientId && clientsData.length > 0 && !client) {
      const found = clientsData.find((c) => c.id === prefilledClientId);
      if (found) setClient(found);
    }
  }, [prefilledClientId, clientsData, client]);

  // Quand le client change, on remet à zéro les retours en attente :
  // ils sont indexés par produit-livraison, qui appartient à un client.
  useEffect(() => {
    setRetoursAttente({});
  }, [client?.id]);

  // Livraisons passées du client courant qui ont encore de la qté
  // retournable. On les trie par date desc pour montrer la plus récente
  // en premier.
  const livraisonsRetournables = useMemo<LivraisonResponse[]>(() => {
    if (!client) return [];
    return (livraisonsQ.data ?? [])
      .filter((l) => l.client.id === client.id)
      .filter((l) =>
        (l.produitsLivraison ?? []).some(
          (p) => (p.qteLivre ?? 0) - (p.qteRetourne ?? 0) > 0,
        ),
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [livraisonsQ.data, client]);

  // Valeur des retours en attente — pour info live au-dessus du bouton
  const totalRetours = useMemo(() => {
    let sum = 0;
    for (const l of livraisonsRetournables) {
      for (const p of l.produitsLivraison ?? []) {
        const qte = retoursAttente[p.id] ?? 0;
        sum += qte * (p.prixDeVente ?? 0);
      }
    }
    return sum;
  }, [livraisonsRetournables, retoursAttente]);

  // Validité des retours saisis (qteRet > qteDispo retournable)
  const retoursInvalides = useMemo(() => {
    let count = 0;
    for (const l of livraisonsRetournables) {
      for (const p of l.produitsLivraison ?? []) {
        const dispo = (p.qteLivre ?? 0) - (p.qteRetourne ?? 0);
        const ret = retoursAttente[p.id] ?? 0;
        if (ret > dispo) count++;
      }
    }
    return count;
  }, [livraisonsRetournables, retoursAttente]);

  const onSubmit = async () => {
    if (!user) {
      Alert.alert('Erreur', 'Session invalide');
      return;
    }
    if (!client) {
      Alert.alert('Erreur', 'Choisis un client');
      return;
    }
    const validLignes = lignes.filter((l) => l.qte > 0);
    const hasRetours = Object.values(retoursAttente).some((q) => q > 0);

    // On accepte une soumission « retours seulement » sans nouvelle livraison
    if (validLignes.length === 0 && !hasRetours) {
      Alert.alert('Erreur', 'Ajoute au moins une ligne livrée OU un retour > 0');
      return;
    }
    if (validLignes.some((l) => l.prix <= 0)) {
      Alert.alert('Erreur', 'Définis un prix unitaire (> 0) pour chaque ligne');
      return;
    }
    if (insufficientCount > 0) {
      Alert.alert(
        'Stock insuffisant',
        `${insufficientCount} ligne${insufficientCount > 1 ? 's' : ''} dépasse${insufficientCount === 1 ? '' : 'nt'} le stock dispo.`,
      );
      return;
    }
    if (retoursInvalides > 0) {
      Alert.alert('Erreur', 'Certains retours dépassent la qté retournable.');
      return;
    }

    try {
      // 1) Création de la nouvelle livraison (si au moins une ligne)
      if (validLignes.length > 0) {
        const payload: CreerLivraisonRequest = {
          livreurId: user.id,
          clientId: client.id,
          avecRemise: client.avecOuSansRemise ?? false,
          produitsLivraison: validLignes.map((l) => ({
            produitId: l.produitId,
            qteLivree: l.qte,
            qteRetournee: 0,
            prixDeVente: l.prix,
          })),
        };
        await m.mutateAsync(payload);
      }

      // 2) Enregistrement des retours sur les livraisons passées —
      // une mutation par livraison source (le back regroupe les lignes).
      for (const liv of livraisonsRetournables) {
        const lignesRet = (liv.produitsLivraison ?? [])
          .map((p) => ({
            produitLivraisonId: p.id,
            quantite: retoursAttente[p.id] ?? 0,
          }))
          .filter((r) => r.quantite > 0);
        if (lignesRet.length === 0) continue;
        await mRetour.mutateAsync({
          livraison: liv,
          request: { livraisonId: liv.id, lignes: lignesRet },
        });
      }

      // 3) Reset & navigate
      setClient(null);
      setLignes([]);
      setRetoursAttente({});
      router.back();
      const summary =
        validLignes.length > 0 && hasRetours
          ? 'Livraison + retour(s) enregistrés'
          : validLignes.length > 0
          ? 'Livraison enregistrée'
          : 'Retour(s) enregistrés';
      Alert.alert('Succès', summary);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert(
        'Erreur',
        e.response?.data?.message ?? "Échec de l'enregistrement",
      );
    }
  };

  const isPending = m.isPending || mRetour.isPending;
  const blockSubmit = isPending || insufficientCount > 0 || retoursInvalides > 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle livraison" />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#10b981"
          />
        }
      >
        <View className="px-4">
          <Text className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Client
          </Text>
          <ClientPicker value={client} onChange={setClient} />

          <View className="mt-5">
            <ProduitPicker
              lignes={lignes}
              onChange={setLignes}
              prixDeVenteParDefaut={client?.prixDeVenteProduitParDefault}
              clientId={client?.id}
              enforceStock
              onValidityChange={setInsufficientCount}
            />
          </View>

          {/* Section « Retours en attente » — affichée si le client a des
              produits livrés avant et non encore retournés */}
          {client && livraisonsRetournables.length > 0 ? (
            <View className="mt-5">
              <View className="flex-row items-center gap-1.5 mb-2">
                <RotateCcw color="#d97706" size={14} />
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                  Retours en attente
                </Text>
              </View>
              <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3 mb-2 flex-row items-start gap-2">
                <Package color="#d97706" size={14} />
                <Text className="text-[11px] text-amber-700 dark:text-amber-400 flex-1">
                  Le client peut te restituer des produits de livraisons
                  précédentes. Saisis la quantité à reprendre — ça
                  ré-incrémente ton stock et déduit le montant de son solde,
                  sans impacter la livraison du jour.
                </Text>
              </View>
              <View className="gap-2">
                {livraisonsRetournables.map((l) => (
                  <RetourLivraisonCard
                    key={l.id}
                    livraison={l}
                    retoursAttente={retoursAttente}
                    onChangeQte={(produitLivraisonId, qte) =>
                      setRetoursAttente((s) => ({
                        ...s,
                        [produitLivraisonId]: qte,
                      }))
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Total livraison + déduction retours pour info */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 gap-1.5">
            <View className="flex-row justify-between">
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                Total livraison
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatFCFA(total)} FCFA
              </Text>
            </View>
            {totalRetours > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-amber-700 dark:text-amber-400">
                  Retours déduits du solde
                </Text>
                <Text className="text-[12px] font-bold text-amber-700 dark:text-amber-400">
                  − {formatFCFA(totalRetours)} F
                </Text>
              </View>
            ) : null}
          </View>

          {insufficientCount > 0 ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3 flex-row items-center gap-2">
              <AlertCircle color="#dc2626" size={14} />
              <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold flex-1">
                {insufficientCount} ligne{insufficientCount > 1 ? 's' : ''} dépasse{insufficientCount === 1 ? '' : 'nt'} le stock dispo.
              </Text>
            </View>
          ) : null}

          {retoursInvalides > 0 ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3 flex-row items-center gap-2">
              <AlertCircle color="#dc2626" size={14} />
              <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold flex-1">
                Un retour dépasse la quantité retournable.
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={blockSubmit}
            className={`rounded-md py-3.5 mt-5 items-center ${
              blockSubmit
                ? 'bg-slate-300 dark:bg-slate-700'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  blockSubmit ? 'text-slate-500' : 'text-white'
                }`}
              >
                {insufficientCount > 0
                  ? 'Stock insuffisant'
                  : retoursInvalides > 0
                  ? 'Retour invalide'
                  : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Carte représentant une livraison passée + ses lignes retournables.
 * Le livreur peut saisir, par produit, la quantité à retourner.
 */
function RetourLivraisonCard({
  livraison,
  retoursAttente,
  onChangeQte,
}: {
  livraison: LivraisonResponse;
  retoursAttente: Record<string, number>;
  onChangeQte: (produitLivraisonId: string, qte: number) => void;
}) {
  const lignes = (livraison.produitsLivraison ?? []).filter(
    (p) => (p.qteLivre ?? 0) - (p.qteRetourne ?? 0) > 0,
  );

  if (lignes.length === 0) return null;

  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
          Livraison du {formatDateShort(livraison.date)}
        </Text>
        <Text className="text-[10px] text-slate-400 dark:text-slate-500">
          {formatFCFA(livraison.montantLivre)} F
        </Text>
      </View>
      <View className="gap-2">
        {lignes.map((p) => {
          const dispo = (p.qteLivre ?? 0) - (p.qteRetourne ?? 0);
          const qte = retoursAttente[p.id] ?? 0;
          const invalide = qte > dispo;
          return (
            <View
              key={p.id}
              className="flex-row items-center gap-2 bg-slate-50 dark:bg-slate-800/50 rounded-md p-2.5"
            >
              <View className="flex-1">
                <Text className="text-[12px] font-bold text-slate-900 dark:text-white">
                  {p.produit?.designation ?? '—'}
                </Text>
                <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                  Livré {p.qteLivre} · Déjà retourné {p.qteRetourne} · Max {dispo}
                </Text>
                {qte > 0 ? (
                  <Text className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-bold">
                    − {formatFCFA(qte * (p.prixDeVente ?? 0))} F déduit du solde
                  </Text>
                ) : null}
              </View>
              <TextInput
                value={qte > 0 ? String(qte) : ''}
                onChangeText={(v) =>
                  onChangeQte(
                    p.id,
                    parseInt(v.replace(/[^0-9]/g, ''), 10) || 0,
                  )
                }
                keyboardType="number-pad"
                selectTextOnFocus
                placeholder="0"
                placeholderTextColor="#94a3b8"
                editable={dispo > 0}
                className={`w-14 px-2 py-1.5 border rounded text-center text-slate-900 dark:text-white text-base ${
                  invalide
                    ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                }`}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
