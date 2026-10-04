import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { dialog } from '../../../lib/dialog';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Package, AlertCircle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ClientPicker } from '../../../components/livreur/ClientPicker';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { DestinationRetourToggle } from '../../../components/livreur/DestinationRetourToggle';
import {
  useCreerLivraison,
  useLivraisonsByLivreur,
} from '../../../features/livraisons/hooks';
import { useEnregistrerRetour } from '../../../features/retours/hooks';
import { qteRetournable, valeurRetour } from '../../../features/retours/api';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { clientKeys } from '../../../features/clients/keys';
import { produitKeys } from '../../../features/produits/keys';
import { useRemisesClient } from '../../../features/remise/hooks';
import {
  bilanLivraisonEtRetours,
  buildCreerLivraisonPayload,
  enregistrerLivraisonEtRetours,
  erreurLignesLivraison,
  regrouperRetours,
  totalLivraisonEstime,
  type SaisieRetours,
} from '../../../features/livraisons/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatFCFA, formatDateShort } from '../../../lib/format';
import type { ClientResponse, LivraisonResponse } from '../../../types/api';

/**
 * Formulaire de nouvelle livraison.
 *
 * Le formulaire affiche en plus une section « Retours en attente » qui
 * liste, pour le client choisi, les produits-livraison passés où il
 * reste de la quantité retournable (`qteLivree − qteRetournee > 0`).
 * Le livreur saisit une quantité à retourner par ligne et choisit
 * « remettre en stock » ou « perdu ». À la soumission :
 *  1. la nouvelle livraison est créée (si au moins une ligne) ;
 *  2. un `PUT /livraison` par livraison passée concernée enregistre les
 *     retours (le back ré-incrémente le stock de la part remise en stock
 *     et baisse le dû du client).
 * Chaque issue est rapportée : en cas d'échec partiel, l'écran dit ce qui
 * est fait et ce qui reste à refaire, et vide la livraison déjà créée pour
 * qu'un nouvel appui ne crée pas une seconde livraison.
 */
export default function NouvelleLivraison() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { clientId: prefilledClientId } = useLocalSearchParams<{ clientId?: string }>();
  const clientsQ = useClientsByLivreur(user?.id ?? '');
  const livraisonsQ = useLivraisonsByLivreur(user?.id ?? '');
  const clientsData = clientsQ.data ?? [];
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  // produitLivraisonId → quantité à retourner + destination (stock / perdu)
  const [retoursAttente, setRetoursAttente] = useState<SaisieRetours>({});
  const [refreshing, setRefreshing] = useState(false);
  const [insufficientCount, setInsufficientCount] = useState(0);
  const [enCours, setEnCours] = useState(false);
  // Garde synchrone contre le double appui (isPending arrive un rendu trop tard).
  const submittingRef = useRef(false);
  const avecRemise = client?.avecOuSansRemise === true;
  const remisesQ = useRemisesClient(avecRemise ? client?.id : undefined);
  const remisesConvenues = useMemo(() => {
    if (!remisesQ.data) return undefined;
    const map = new Map<string, number>();
    for (const r of remisesQ.data) {
      if (r.produit?.id) map.set(r.produit.id, Number(r.remiseUnitaire) || 0);
    }
    return map;
  }, [remisesQ.data]);
  const total = totalLivraisonEstime(lignes, avecRemise);
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
  // La remise et le choix « mémoriser » appartiennent au client précédent :
  // ils sont réinitialisés (la remise est re-pré-remplie pour le nouveau).
  useEffect(() => {
    setRetoursAttente({});
    setLignes((ls) =>
      ls.map((l) => ({ ...l, remise: undefined, remiseInvalide: false, memoriserPrix: false })),
    );
  }, [client?.id]);

  // Livraisons passées du client courant qui ont encore de la qté
  // retournable. On les trie par date desc pour montrer la plus récente
  // en premier.
  const livraisonsRetournables = useMemo<LivraisonResponse[]>(() => {
    if (!client) return [];
    return (livraisonsQ.data ?? [])
      .filter((l) => l.client.id === client.id)
      .filter((l) => (l.produitsLivraison ?? []).some((p) => qteRetournable(p) > 0))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [livraisonsQ.data, client]);

  // Valeur des retours en attente (estimation : (prix + remise) × quantité)
  const totalRetours = useMemo(() => {
    let sum = 0;
    for (const l of livraisonsRetournables) {
      for (const p of l.produitsLivraison ?? []) {
        sum += valeurRetour(p, retoursAttente[p.id]?.qte ?? 0);
      }
    }
    return sum;
  }, [livraisonsRetournables, retoursAttente]);

  // Validité des retours saisis (qteRet > qteDispo retournable)
  const retoursInvalides = useMemo(() => {
    let count = 0;
    for (const l of livraisonsRetournables) {
      for (const p of l.produitsLivraison ?? []) {
        if ((retoursAttente[p.id]?.qte ?? 0) > qteRetournable(p)) count++;
      }
    }
    return count;
  }, [livraisonsRetournables, retoursAttente]);

  const onSubmit = async () => {
    if (submittingRef.current) return;
    if (!user) {
      dialog.error('Session invalide', 'Reconnecte-toi pour continuer.');
      return;
    }
    if (!client) {
      dialog.warning('Choisis un client', 'Sélectionne un client avant d’enregistrer.');
      return;
    }
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Reconnecte-toi pour enregistrer la livraison.');
      return;
    }
    const validLignes = lignes.filter((l) => l.qte > 0);
    const retours = regrouperRetours(livraisonsRetournables, retoursAttente);

    // On accepte une soumission « retours seulement » sans nouvelle livraison
    if (validLignes.length === 0 && retours.length === 0) {
      dialog.warning('Rien à enregistrer', 'Ajoute au moins une ligne livrée ou un retour > 0.');
      return;
    }
    const erreurLignes = erreurLignesLivraison(validLignes, avecRemise);
    if (erreurLignes) {
      dialog.warning('Ligne invalide', erreurLignes);
      return;
    }
    if (insufficientCount > 0) {
      dialog.error(
        'Stock insuffisant',
        `${insufficientCount} ligne${insufficientCount > 1 ? 's' : ''} dépasse${insufficientCount === 1 ? '' : 'nt'} le stock dispo.`,
      );
      return;
    }
    if (retoursInvalides > 0) {
      dialog.error('Retours invalides', 'Certains retours dépassent la quantité retournable.');
      return;
    }

    submittingRef.current = true;
    setEnCours(true);
    try {
      const payload =
        validLignes.length > 0
          ? buildCreerLivraisonPayload({ livreurId: user.id, client, lignes: validLignes })
          : null;
      const res = await enregistrerLivraisonEtRetours({
        creer: payload ? () => m.mutateAsync(payload) : null,
        retours,
        enregistrerRetour: (r) =>
          mRetour.mutateAsync({
            livraison: r.livraison,
            request: { livraisonId: r.livraison.id, lignes: r.lignes },
          }),
        messageErreur: (err) => extractApiErrorMessage(err, "Échec de l'enregistrement"),
      });
      const bilan = bilanLivraisonEtRetours(res, {
        livraison: payload !== null,
        nbRetours: retours.length,
      });

      if (bilan.ok) {
        setClient(null);
        setLignes([]);
        setRetoursAttente({});
        router.back();
        dialog.success(bilan.titre);
        return;
      }
      if (res.erreurLivraison === null) {
        // Échec partiel : la livraison créée est retirée du formulaire (un
        // nouvel appui ne la recrée pas), seuls les retours échoués restent.
        if (res.livraisonCreee) setLignes([]);
        const faits = new Set<string>();
        for (const r of retours) {
          if (res.retoursEnregistres.includes(r.livraison.id)) {
            for (const l of r.lignes) faits.add(l.produitLivraisonId);
          }
        }
        setRetoursAttente((s) => {
          const reste: SaisieRetours = {};
          for (const [id, v] of Object.entries(s)) if (!faits.has(id)) reste[id] = v;
          return reste;
        });
      }
      dialog.error(bilan.titre, bilan.message);
    } finally {
      submittingRef.current = false;
      setEnCours(false);
    }
  };

  const isPending = enCours || m.isPending || mRetour.isPending;
  const blockSubmit =
    isPending || !isOnline || insufficientCount > 0 || retoursInvalides > 0;

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
              avecRemise={avecRemise}
              remisesConvenues={remisesConvenues}
            />
          </View>

          {/* Section « Retours en attente » — toujours visible quand un
              client est sélectionné. Les retours portent sur des livraisons
              précédentes (les produits retournés peuvent différer des
              produits livrés du jour). */}
          {client ? (
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
                  précédentes (souvent différents des produits livrés du
                  jour). Saisis la quantité reprise et choisis « Remettre en
                  stock » (elle revient dans ton stock) ou « Perdu ». Le
                  montant est déduit du dû du client, sans impacter la
                  livraison du jour.
                </Text>
              </View>
              {livraisonsRetournables.length > 0 ? (
                <View className="gap-2">
                  {livraisonsRetournables.map((l) => (
                    <RetourLivraisonCard
                      key={l.id}
                      livraison={l}
                      retoursAttente={retoursAttente}
                      onChangeQte={(produitLivraisonId, qte) =>
                        setRetoursAttente((s) => ({
                          ...s,
                          [produitLivraisonId]: {
                            qte,
                            enStock: s[produitLivraisonId]?.enStock ?? false,
                          },
                        }))
                      }
                      onChangeEnStock={(produitLivraisonId, enStock) =>
                        setRetoursAttente((s) => ({
                          ...s,
                          [produitLivraisonId]: {
                            qte: s[produitLivraisonId]?.qte ?? 0,
                            enStock,
                          },
                        }))
                      }
                    />
                  ))}
                </View>
              ) : (
                <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 items-center">
                  <Text className="text-[12px] text-slate-400 text-center">
                    Aucun produit livré antérieurement à reprendre pour ce
                    client.
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Total livraison + déduction retours pour info */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 gap-1.5">
            <View className="flex-row justify-between">
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                Total livraison (estimation)
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatFCFA(total)} FCFA
              </Text>
            </View>
            {totalRetours > 0 ? (
              <View className="flex-row justify-between">
                <Text className="text-[12px] text-amber-700 dark:text-amber-400">
                  Retours déduits du dû (estimation)
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
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : insufficientCount > 0
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
  onChangeEnStock,
}: {
  livraison: LivraisonResponse;
  retoursAttente: SaisieRetours;
  onChangeQte: (produitLivraisonId: string, qte: number) => void;
  onChangeEnStock: (produitLivraisonId: string, enStock: boolean) => void;
}) {
  const lignes = (livraison.produitsLivraison ?? []).filter((p) => qteRetournable(p) > 0);

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
          const dispo = qteRetournable(p);
          const qte = retoursAttente[p.id]?.qte ?? 0;
          const enStock = retoursAttente[p.id]?.enStock ?? false;
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
                  <>
                    <Text className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5 font-bold">
                      − {formatFCFA(valeurRetour(p, qte))} F déduit du dû (estimation)
                    </Text>
                    <DestinationRetourToggle
                      enStock={enStock}
                      onChange={(v) => onChangeEnStock(p.id, v)}
                    />
                  </>
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
