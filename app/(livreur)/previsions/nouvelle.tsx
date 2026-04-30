import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { SelectField } from '../../../components/shared/SelectField';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import { useProduits } from '../../../features/produits/hooks';
import { useCreerPrevision } from '../../../features/previsions/hooks';
import { useAuthStore } from '../../../stores/authStore';

/**
 * Formulaire « Nouvelle prévision » multi-produits par client. Le livreur
 * choisit un client + une date, puis saisit une quantité par produit.
 * Tous les produits avec une qté > 0 sont créés en une seule action via
 * une boucle de mutations (l'API ne propose pas de batch côté back).
 *
 * Mirror simplifié de la page web `PrevisionsPage` qui utilise un tableau
 * tous produits.
 */
export default function NouvellePrevision() {
  const params = useLocalSearchParams<{ date?: string }>();
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';

  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [clientId, setClientId] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(params.date ?? tomorrow);
  const [qtes, setQtes] = useState<Record<string, string>>({});
  const [commentaire, setCommentaire] = useState('');

  const clientsQ = useClientsByLivreur(livreurId);
  const produitsQ = useProduits();
  const m = useCreerPrevision();

  const clientOptions = useMemo(
    () =>
      (clientsQ.data ?? []).map((c) => ({
        id: c.id,
        label: `${c.prenom} ${c.nom}`,
      })),
    [clientsQ.data],
  );

  const lignesAvecQte = useMemo(() => {
    return (produitsQ.data ?? [])
      .map((p) => ({
        produit: p,
        qte: parseInt(qtes[p.id] ?? '0', 10) || 0,
      }))
      .filter((l) => l.qte > 0);
  }, [produitsQ.data, qtes]);

  const onSubmit = async () => {
    if (!user) return;
    if (!clientId) {
      Alert.alert('Erreur', 'Choisis un client');
      return;
    }
    if (!date) {
      Alert.alert('Erreur', 'Date requise');
      return;
    }
    if (lignesAvecQte.length === 0) {
      Alert.alert('Erreur', 'Saisis au moins une quantité > 0');
      return;
    }

    // Crée toutes les prévisions en parallèle. Le back invalide le cache
    // une fois pour la dernière, ce qui suffit (les prévisions
    // précédentes apparaîtront aussi via le refetch sur invalidation).
    try {
      await Promise.all(
        lignesAvecQte.map((l) =>
          m.mutateAsync({
            livreurId,
            clientId,
            produitId: l.produit.id,
            qteEstimee: l.qte,
            dateLivraison: date,
            commentaire: commentaire.trim() || undefined,
          }),
        ),
      );
      router.back();
      Alert.alert(
        'Succès',
        `${lignesAvecQte.length} prévision${lignesAvecQte.length > 1 ? 's' : ''} créée${lignesAvecQte.length > 1 ? 's' : ''}`,
      );
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      Alert.alert('Erreur', e.response?.data?.message ?? 'Échec création');
    }
  };

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle prévision" subtitle="Multi-produits par client" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 gap-3">
          {/* Client */}
          <SelectField
            label="Client *"
            placeholder="Choisir un client"
            value={clientId}
            onChange={setClientId}
            options={clientOptions}
            isLoading={clientsQ.isLoading}
            emptyMessage="Aucun client. Crée-en depuis l'onglet Clients."
          />

          {/* Date */}
          <DatePickerField
            label="Date de livraison *"
            value={date}
            onChange={setDate}
          />

          {/* Produits */}
          <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-2">
            Quantités estimées
          </Text>
          <View className="gap-2">
            {(produitsQ.data ?? []).map((p) => (
              <View
                key={p.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2"
              >
                <View className="flex-1">
                  <Text className="font-bold text-slate-900 dark:text-white">
                    {p.designation}
                  </Text>
                  {p.code ? (
                    <Text className="text-[10px] font-mono text-slate-400 mt-0.5">
                      {p.code}
                    </Text>
                  ) : null}
                </View>
                <TextInput
                  value={qtes[p.id] ?? ''}
                  onChangeText={(v) =>
                    setQtes((q) => ({
                      ...q,
                      [p.id]: v.replace(/[^0-9]/g, ''),
                    }))
                  }
                  keyboardType="number-pad"
                  selectTextOnFocus
                  placeholder="0"
                  placeholderTextColor="#94a3b8"
                  className="w-20 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-center text-slate-900 dark:text-white text-base"
                />
              </View>
            ))}
          </View>

          {/* Commentaire */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Commentaire (optionnel)
            </Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              placeholder="…"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white"
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || lignesAvecQte.length === 0}
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${
              lignesAvecQte.length === 0
                ? 'bg-slate-300 dark:bg-slate-700'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Plus
                  color={lignesAvecQte.length === 0 ? '#94a3b8' : '#ffffff'}
                  size={16}
                />
                <Text
                  className={`font-bold text-base ${
                    lignesAvecQte.length === 0 ? 'text-slate-500' : 'text-white'
                  }`}
                >
                  {lignesAvecQte.length === 0
                    ? 'Aucune ligne'
                    : `Ajouter ${lignesAvecQte.length} ligne${lignesAvecQte.length > 1 ? 's' : ''}`}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
