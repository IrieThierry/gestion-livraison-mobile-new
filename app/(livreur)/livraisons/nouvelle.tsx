import { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ClientPicker } from '../../../components/livreur/ClientPicker';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { useCreerLivraison } from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';
import type { ClientResponse, CreerLivraisonRequest } from '../../../types/api';

export default function NouvelleLivraison() {
  const user = useAuthStore((s) => s.user);
  const { clientId: prefilledClientId } = useLocalSearchParams<{ clientId?: string }>();
  const { data: clientsData = [] } = useClientsByLivreur(user?.id ?? '');
  const [client, setClient] = useState<ClientResponse | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const total = lignes.reduce((acc, l) => acc + l.prix * l.qte, 0);
  const m = useCreerLivraison();

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

    // Payload conforme à `CreerLivraisonRequest` (cf. types/api.ts) — c'est
    // exactement ce que la page web `NouvelleLivraisonPage` envoie.
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

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
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
            />
          </View>

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 flex-row justify-between">
            <Text className="font-bold text-slate-700 dark:text-slate-300">Total</Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(total)} FCFA
            </Text>
          </View>

          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-5 items-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">Enregistrer</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
