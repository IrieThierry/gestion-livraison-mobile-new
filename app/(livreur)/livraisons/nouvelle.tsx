import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { dialog } from '../../../lib/dialog';
import { useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ClientPicker } from '../../../components/livreur/ClientPicker';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { useCreerLivraison } from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { clientKeys } from '../../../features/clients/keys';
import { produitKeys } from '../../../features/produits/keys';
import { peutFixerConditions } from '../../../features/remise/regles';
import {
  buildCreerLivraisonPayload,
  erreurLignesLivraison,
  remiseLivraison,
  totalLivraisonEstime,
} from '../../../features/livraisons/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatFCFA } from '../../../lib/format';
import { useRetourListe } from '../../../lib/useRetourListe';
import type { ClientResponse } from '../../../types/api';

const LISTE_LIVRAISONS = '/(livreur)/livraisons';

/**
 * Formulaire de nouvelle livraison : client + produits livrés.
 *
 * Les retours clients ne se saisissent plus ici : ils ont leur écran dédié
 * (« Retour client », `cash/retour-client`). Après enregistrement, on
 * arrive sur la liste des livraisons.
 */
export default function NouvelleLivraison() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const { clientId: prefilledClientId } = useLocalSearchParams<{ clientId?: string }>();
  const clientsQ = useClientsByLivreur(user?.id ?? '');
  const clientsData = clientsQ.data ?? [];
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [insufficientCount, setInsufficientCount] = useState(0);
  // Garde synchrone contre le double appui (isPending arrive un rendu trop tard).
  const submittingRef = useRef(false);
  const avecRemise = client?.avecOuSansRemise === true;
  const conditionsFixables = peutFixerConditions(user);
  // D21 : remise unique du client, lecture seule, identique pour toutes les lignes.
  const remise = remiseLivraison(client);
  const total = totalLivraisonEstime(lignes, remise);
  const m = useCreerLivraison();
  const qc = useQueryClient();
  const retourListe = useRetourListe(LISTE_LIVRAISONS);

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

  // Le choix « mémoriser » appartient au client précédent : il est réinitialisé.
  useEffect(() => {
    setLignes((ls) =>
      ls.map((l) => ({
        ...l,
        memoriserPrix: false,
      })),
    );
  }, [client?.id]);

  const onSubmit = () => {
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
    if (validLignes.length === 0) {
      dialog.warning('Rien à enregistrer', 'Ajoute au moins une ligne livrée.');
      return;
    }
    const erreurLignes = erreurLignesLivraison(validLignes);
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

    submittingRef.current = true;
    const payload = buildCreerLivraisonPayload({
      livreurId: user.id,
      client,
      lignes: validLignes,
      conditionsFixables,
    });
    m.mutate(payload, {
      onSuccess: () => {
        setClient(null);
        setLignes([]);
        retourListe();
        dialog.success('Livraison enregistrée');
      },
      onError: (err) => {
        dialog.error('Livraison non enregistrée', extractApiErrorMessage(err, "Échec de l'enregistrement"));
      },
      onSettled: () => {
        submittingRef.current = false;
      },
    });
  };

  const isPending = m.isPending;
  const blockSubmit = isPending || !isOnline || insufficientCount > 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle livraison" retourVers={LISTE_LIVRAISONS} />

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
              remiseClient={avecRemise ? remise : undefined}
              memoriserPossible={conditionsFixables}
            />
          </View>

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5">
            <View className="flex-row justify-between">
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                Total livraison (estimation)
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {formatFCFA(total)} FCFA
              </Text>
            </View>
          </View>

          {insufficientCount > 0 ? (
            <View className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-md p-3 mt-3 flex-row items-center gap-2">
              <AlertCircle color="#dc2626" size={14} />
              <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold flex-1">
                {insufficientCount} ligne{insufficientCount > 1 ? 's' : ''} dépasse{insufficientCount === 1 ? '' : 'nt'} le stock dispo.
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
                  : 'Enregistrer'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
