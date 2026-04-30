import { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { PageHeader } from '../../../components/shared/PageHeader';
import { ProduitPicker, type Ligne } from '../../../components/livreur/ProduitPicker';
import { useEnregistrerAchat } from '../../../features/stock/hooks';
import { useFournisseurs } from '../../../features/lookups/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';
import type { EnregistrerStockRequest } from '../../../types/api';

export default function DeclarerAchat() {
  const user = useAuthStore((s) => s.user);
  const { data: fournisseurs = [], isLoading: loadingFournisseurs } = useFournisseurs();
  const [fournisseurId, setFournisseurId] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const m = useEnregistrerAchat();

  // Pour le total affiché : on multiplie quantité × prix indicatif venant du
  // catalogue (`prixAchatParDefaut`). Le back ne lit pas ce prix dans la
  // requête (cf. `LigneStockRequest` = { produitId, qte }) — c'est purement
  // une aide visuelle pour le livreur.
  const totalAchat = lignes.reduce((acc, l) => acc + l.prix * l.qte, 0);

  const onSubmit = () => {
    if (!user) {
      Alert.alert('Erreur', 'Session invalide');
      return;
    }
    if (!fournisseurId) {
      Alert.alert('Erreur', 'Choisis un fournisseur');
      return;
    }
    const validLignes = lignes.filter((l) => l.qte > 0);
    if (validLignes.length === 0) {
      Alert.alert('Erreur', 'Ajoute au moins une ligne avec une quantité > 0');
      return;
    }

    const payload: EnregistrerStockRequest = {
      livreurId: user.id,
      fournisseurId,
      lignes: validLignes.map((l) => ({
        produitId: l.produitId,
        qte: l.qte,
      })),
    };

    m.mutate(payload, {
      onSuccess: () => {
        router.back();
        Alert.alert('Succès', 'Achat enregistré, ton stock est mis à jour');
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
      <PageHeader title="Déclarer un achat" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4">
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
            Fournisseur
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {loadingFournisseurs ? (
              <Text className="text-slate-400 text-sm">Chargement…</Text>
            ) : fournisseurs.length === 0 ? (
              <Text className="text-slate-400 text-sm">
                Aucun fournisseur disponible
              </Text>
            ) : (
              fournisseurs.map((f) => {
                const selected = fournisseurId === f.id;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setFournisseurId(f.id)}
                    className={`px-3 py-2 rounded-md ${
                      selected
                        ? 'bg-emerald-500'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Text
                      className={`text-sm font-bold ${
                        selected
                          ? 'text-white'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {f.libelle}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View className="mt-5">
            <ProduitPicker lignes={lignes} onChange={setLignes} />
          </View>

          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 mt-5 flex-row justify-between">
            <Text className="font-bold text-slate-700 dark:text-slate-300">
              Total achat
            </Text>
            <Text className="font-extrabold text-emerald-600 dark:text-emerald-400">
              {formatFCFA(totalAchat)} FCFA
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
