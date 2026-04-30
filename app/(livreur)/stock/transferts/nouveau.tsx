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
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { SelectField } from '../../../../components/shared/SelectField';
import { useApprentis } from '../../../../features/apprentis/hooks';
import { useStockCourant } from '../../../../features/stock/hooks';
import { useEffectuerTransfert } from '../../../../features/transferts/hooks';
import { useAuthStore } from '../../../../stores/authStore';
import { formatFCFA } from '../../../../lib/format';

/**
 * Formulaire de transfert root → apprenti. Le livreur connecté est la
 * source, on choisit un apprenti destinataire + un produit + une qté.
 *
 * Le back vérifie que :
 *   - le livreur source possède le stock disponible
 *   - le destinataire fait partie de la hiérarchie du parent
 */
export default function NouveauTransfert() {
  const user = useAuthStore((s) => s.user);
  const apprentisQ = useApprentis();
  const stockQ = useStockCourant();
  const m = useEffectuerTransfert();

  const [destinataireId, setDestinataireId] = useState<string | null>(null);
  const [produitId, setProduitId] = useState<string | null>(null);
  const [qte, setQte] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const apprentisOptions = useMemo(
    () =>
      (apprentisQ.data ?? [])
        .filter((a) => a.actif !== false)
        .map((a) => ({
          id: a.id,
          label: `${a.prenom} ${a.nom}`,
        })),
    [apprentisQ.data],
  );

  const stockOptions = useMemo(
    () =>
      (stockQ.data ?? [])
        .filter((s) => (s.qteVendable ?? 0) > 0)
        .map((s) => ({
          id: s.produit.id,
          label: `${s.produit.designation} · stock ${s.qteVendable}`,
        })),
    [stockQ.data],
  );

  const stockDispo = useMemo(() => {
    if (!produitId) return 0;
    const s = (stockQ.data ?? []).find((x) => x.produit.id === produitId);
    return s?.qteVendable ?? 0;
  }, [produitId, stockQ.data]);

  const qteNum = parseInt(qte, 10) || 0;
  const insuffisant = qteNum > stockDispo;

  const onSubmit = () => {
    if (!user) return;
    if (!destinataireId) {
      Alert.alert('Erreur', 'Choisis un apprenti destinataire');
      return;
    }
    if (!produitId) {
      Alert.alert('Erreur', 'Choisis un produit');
      return;
    }
    if (!qteNum || qteNum <= 0) {
      Alert.alert('Erreur', 'Quantité invalide');
      return;
    }
    if (insuffisant) {
      Alert.alert('Erreur', `Stock insuffisant (max : ${stockDispo})`);
      return;
    }
    m.mutate(
      {
        sourceId: user.id,
        destinataireId,
        produitId,
        qte: qteNum,
        commentaire: commentaire.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.back();
          Alert.alert('Succès', 'Transfert enregistré');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert('Erreur', e.response?.data?.message ?? 'Transfert refusé');
        },
      },
    );
  };

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau transfert" subtitle="Vers un apprenti" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 gap-3">
          {/* Source visualisée */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Source
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {user.prenom} {user.nom} (toi)
              </Text>
            </View>
            <ArrowRight color="#10b981" size={20} />
            <View className="flex-1 items-end">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                Destinataire
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {destinataireId
                  ? apprentisOptions.find((o) => o.id === destinataireId)?.label
                  : '—'}
              </Text>
            </View>
          </View>

          <SelectField
            label="Apprenti destinataire *"
            placeholder="Choisir un apprenti"
            value={destinataireId}
            onChange={setDestinataireId}
            options={apprentisOptions}
            isLoading={apprentisQ.isLoading}
            emptyMessage="Aucun apprenti actif. Crée un apprenti depuis Profil → Mes apprentis."
          />

          <SelectField
            label="Produit *"
            placeholder="Choisir un produit"
            value={produitId}
            onChange={setProduitId}
            options={stockOptions}
            isLoading={stockQ.isLoading}
            emptyMessage="Aucun produit en stock. Déclare un achat fournisseur d'abord."
          />

          {/* Quantité */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Quantité * {produitId ? `(stock dispo : ${stockDispo})` : ''}
            </Text>
            <TextInput
              value={qte}
              onChangeText={setQte}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className={`px-4 py-3.5 bg-white dark:bg-slate-900 border rounded-md text-slate-900 dark:text-white text-2xl font-extrabold ${
                insuffisant
                  ? 'border-red-400 bg-red-50 dark:bg-red-500/10'
                  : 'border-slate-200 dark:border-slate-800'
              }`}
            />
            {insuffisant ? (
              <Text className="text-[11px] text-red-500 font-bold mt-1">
                Stock insuffisant (max : {stockDispo})
              </Text>
            ) : null}
          </View>

          {/* Commentaire */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
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
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending || insuffisant}
            className={`rounded-md py-3.5 mt-3 items-center ${
              insuffisant
                ? 'bg-slate-300 dark:bg-slate-700'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  insuffisant ? 'text-slate-500' : 'text-white'
                }`}
              >
                {insuffisant ? 'Stock insuffisant' : 'Effectuer le transfert'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
