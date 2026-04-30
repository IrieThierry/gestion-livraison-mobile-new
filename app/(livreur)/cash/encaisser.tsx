import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  useLivraisonsByLivreur,
  useEncaisserLivraison,
} from '../../../features/livraisons/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { formatFCFA } from '../../../lib/format';

// Cible du bouton "Encaisser" du détail livraison. Récupère la livraison
// dans le cache `byLivreur` (pas d'endpoint by-id côté back), affiche un
// récap (total livré / déjà encaissé / reste) puis poste vers
// POST /encaissement/livraison via `useEncaisserLivraison`.
//
// Note typage : `LivraisonResponse` n'expose pas `montantEncaisse` côté
// front (le backend ne renvoie pas le cumul payé). On laisse donc le
// "déjà encaissé" à 0 — le reste à encaisser vaut le montant livré tant
// que le statut n'est pas ENCAISSEE. Si un jour le back ajoute le champ,
// remplacer le fallback ci-dessous.
export default function EncaisserLivraison() {
  const { livraisonId } = useLocalSearchParams<{ livraisonId: string }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';
  const q = useLivraisonsByLivreur(livreurId);
  const m = useEncaisserLivraison();

  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');

  if (!user) return null;
  if (q.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  const livraison = (q.data ?? []).find((l) => l.id === livraisonId);
  if (!livraison) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Encaisser" />
        <EmptyState
          title="Livraison introuvable"
          message="Reviens à la tournée et choisis une livraison."
        />
      </View>
    );
  }

  const total = livraison.montantLivre ?? 0;
  // `LivraisonResponse` ne porte pas le cumul encaissé — fallback à 0.
  const dejaEncaisse =
    (livraison as { montantEncaisse?: number }).montantEncaisse ?? 0;
  const reste = Math.max(0, total - dejaEncaisse);

  const onSubmit = () => {
    const n = parseInt(montant, 10);
    if (!n || n <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    if (n > reste) {
      Alert.alert(
        'Erreur',
        `Le montant dépasse le reste à encaisser (${formatFCFA(reste)} FCFA)`,
      );
      return;
    }
    m.mutate(
      {
        montantEncaisse: n,
        livreurId: user.id,
        livraisonIds: [livraison.id],
        clientId: livraison.client.id,
        commentaire: commentaire.trim(),
      },
      {
        onSuccess: () => {
          router.back();
          Alert.alert('Succès', 'Encaissement enregistré');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert(
            'Erreur',
            e.response?.data?.message ?? 'Échec de l’encaissement',
          );
        },
      },
    );
  };

  const clientName = `${livraison.client.prenom} ${livraison.client.nom}`;
  const montantInt = parseInt(montant, 10) || 0;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Encaisser" subtitle={clientName} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          {/* Récap */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            <View className="flex-row justify-between">
              <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                Total livré
              </Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(total)} FCFA
              </Text>
            </View>
            {dejaEncaisse > 0 ? (
              <View className="flex-row justify-between mt-1">
                <Text className="text-slate-500 dark:text-slate-400 text-[12px]">
                  Déjà encaissé
                </Text>
                <Text className="font-bold text-emerald-700 dark:text-emerald-400">
                  {formatFCFA(dejaEncaisse)} FCFA
                </Text>
              </View>
            ) : null}
            <View className="border-t border-slate-100 dark:border-slate-800 mt-3 pt-3 flex-row justify-between">
              <Text className="text-slate-700 dark:text-slate-300 font-bold">
                Reste à encaisser
              </Text>
              <Text className="font-extrabold text-amber-600 dark:text-amber-400 text-base">
                {formatFCFA(reste)} FCFA
              </Text>
            </View>
          </View>

          {/* Montant */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Montant reçu
          </Text>
          <TextInput
            value={montant}
            onChangeText={setMontant}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
          />

          {/* Quick fill */}
          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={() => setMontant(String(reste))}
              className="bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md active:opacity-70"
            >
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                Tout ({formatFCFA(reste)})
              </Text>
            </Pressable>
          </View>

          {/* Commentaire */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Commentaire (optionnel)
          </Text>
          <TextInput
            value={commentaire}
            onChangeText={setCommentaire}
            multiline
            placeholder="…"
            placeholderTextColor="#94a3b8"
            className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
          />

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || !isOnline}
            className={`rounded-md py-3.5 mt-6 items-center ${
              !isOnline
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : `Encaisser ${formatFCFA(montantInt)} FCFA`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
