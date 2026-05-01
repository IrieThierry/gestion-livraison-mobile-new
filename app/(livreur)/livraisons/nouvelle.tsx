import { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ClientPicker } from '../../../components/livreur/ClientPicker';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { useCreerLivraison } from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { clientKeys } from '../../../features/clients/keys';
import { produitKeys } from '../../../features/produits/keys';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';
import type { ClientResponse, CreerLivraisonRequest } from '../../../types/api';

export default function NouvelleLivraison() {
  const user = useAuthStore((s) => s.user);
  const { clientId: prefilledClientId } = useLocalSearchParams<{ clientId?: string }>();
  const clientsQ = useClientsByLivreur(user?.id ?? '');
  const clientsData = clientsQ.data ?? [];
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insufficientCount, setInsufficientCount] = useState(0);
  // Total = somme des `prix × (qte livrée − qte retournée)` sur chaque ligne.
  // Une qté retournée saisie au moment de la livraison réduit d'autant le
  // total, comme côté web (`(qteLivree - qteRetournee) * prixDeVente`).
  const total = lignes.reduce(
    (acc, l) => acc + l.prix * Math.max(0, l.qte - (l.qteRet ?? 0)),
    0,
  );
  const m = useCreerLivraison();
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

  const onSubmit = () => {
    if (!user) {
      Alert.alert('Erreur', 'Session invalide');
      return;
    }
    if (!client) {
      Alert.alert('Erreur', 'Choisis un client');
      return;
    }
    const validLignes = lignes.filter((l) => l.qte > 0);
    if (validLignes.length === 0) {
      Alert.alert('Erreur', 'Ajoute au moins une ligne avec une quantité > 0');
      return;
    }
    // Sécurité côté UX : un prix à 0 signifie « prix non défini » (le client
    // n'a pas de prixDeVenteProduitParDefault et le produit n'a pas de
    // prixAchatParDefaut). Le back accepterait, mais la marge calculée
    // serait fausse — on force le livreur à saisir un prix réel.
    if (validLignes.some((l) => l.prix <= 0)) {
      Alert.alert('Erreur', 'Définis un prix unitaire (> 0) pour chaque ligne');
      return;
    }
    // Stock check : doublon de la garde UI (le bouton est déjà désactivé)
    // mais on garde une dernière barrière au cas où l'état stock arrive
    // entre le tap et le moment où le bouton se désactive.
    if (insufficientCount > 0) {
      Alert.alert(
        'Stock insuffisant',
        `${insufficientCount} ligne${insufficientCount > 1 ? 's' : ''} dépasse${insufficientCount === 1 ? '' : 'nt'} le stock dispo.`,
      );
      return;
    }

    // Bloque les retours invalides (qteRet > qte) — l'erreur côté UI
    // est déjà visible mais on rajoute une garde finale.
    if (validLignes.some((l) => (l.qteRet ?? 0) > l.qte)) {
      Alert.alert(
        'Erreur',
        'Une ligne a un retour supérieur à la quantité livrée',
      );
      return;
    }

    // Payload conforme à `CreerLivraisonRequest` (cf. types/api.ts) — c'est
    // exactement ce que la page web `NouvelleLivraisonPage` envoie. La
    // `qteRetournee` peut être > 0 si le client a refusé une partie au
    // moment de la livraison (le back ré-incrémente le stock côté serveur).
    const payload: CreerLivraisonRequest = {
      livreurId: user.id,
      clientId: client.id,
      avecRemise: client.avecOuSansRemise ?? false,
      produitsLivraison: validLignes.map((l) => ({
        produitId: l.produitId,
        qteLivree: l.qte,
        qteRetournee: l.qteRet ?? 0,
        prixDeVente: l.prix,
      })),
    };

    m.mutate(payload, {
      onSuccess: () => {
        setClient(null);
        setLignes([]);
        router.back();
        Alert.alert('Succès', 'Livraison enregistrée');
      },
      onError: (err: unknown) => {
        const e = err as { response?: { data?: { message?: string } } };
        Alert.alert(
          'Erreur',
          e.response?.data?.message ?? "Échec de l'enregistrement",
        );
      },
    });
  };

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
              allowReturns
              onValidityChange={setInsufficientCount}
            />
          </View>

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 flex-row justify-between">
            <Text className="font-bold text-slate-700 dark:text-slate-300">Total</Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(total)} FCFA
            </Text>
          </View>

          {insufficientCount > 0 ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3 flex-row items-center gap-2">
              <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold flex-1">
                {insufficientCount} ligne{insufficientCount > 1 ? 's' : ''} dépasse{insufficientCount === 1 ? '' : 'nt'} le stock dispo — réduis les quantités pour pouvoir enregistrer.
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || insufficientCount > 0}
            className={`rounded-md py-3.5 mt-5 items-center ${
              insufficientCount > 0
                ? 'bg-slate-300 dark:bg-slate-700'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  insufficientCount > 0 ? 'text-slate-500' : 'text-white'
                }`}
              >
                {insufficientCount > 0 ? 'Stock insuffisant' : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
