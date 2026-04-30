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
import { CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { useEnregistrerCloture } from '../../../features/clotures/hooks';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { formatFCFA } from '../../../lib/format';

/**
 * Formulaire « Nouvelle clôture journalière ».
 *
 * Calcule en live le total livré et le total encaissé du jour à partir
 * du cache local, puis demande au livreur de saisir le montant remis
 * (espèces effectivement remises au gestionnaire / au coffre). Le back
 * calcule l'écart de caisse = montantRemis − totalEncaisse.
 */
export default function NouvelleCloture() {
  const user = useAuthStore((s) => s.user);
  const livreurId = user?.id ?? '';
  const today = new Date().toISOString().slice(0, 10);

  const [dateCloture, setDateCloture] = useState<string | null>(today);
  const [montantRemis, setMontantRemis] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const livQ = useLivraisonsByLivreur(livreurId);
  const encQ = useEncaissementsByLivreur(livreurId);
  const m = useEnregistrerCloture();

  const stats = useMemo(() => {
    const day = (dateCloture ?? today).slice(0, 10);
    const dayStart = new Date(`${day}T00:00:00`).getTime();
    const dayEnd = dayStart + 86_400_000;

    const livraisons = livQ.data ?? [];
    const encs = encQ.data ?? [];

    const totalLivre = livraisons
      .filter((l) => {
        const t = new Date(l.date).getTime();
        return t >= dayStart && t < dayEnd;
      })
      .reduce((acc, l) => acc + (l.montantLivre ?? 0), 0);

    const totalEncaisse = encs
      .filter((e) => {
        if (!e.date) return false;
        const t = new Date(e.date).getTime();
        return t >= dayStart && t < dayEnd;
      })
      .reduce((acc, e) => acc + (e.montantEncaisse ?? 0), 0);

    return { totalLivre, totalEncaisse };
  }, [dateCloture, today, livQ.data, encQ.data]);

  const remisNum = parseInt(montantRemis, 10) || 0;
  const ecart = remisNum - stats.totalEncaisse;
  const balanced = remisNum > 0 && ecart === 0;

  const onSubmit = () => {
    if (!user) return;
    if (!dateCloture) {
      Alert.alert('Erreur', 'Date requise');
      return;
    }
    if (remisNum < 0) {
      Alert.alert('Erreur', 'Montant remis invalide');
      return;
    }
    m.mutate(
      {
        livreurId: user.id,
        dateCloture,
        montantRemis: remisNum,
        commentaire: commentaire.trim(),
      },
      {
        onSuccess: () => {
          router.back();
          Alert.alert(
            'Succès',
            balanced
              ? 'Clôture enregistrée — caisse équilibrée'
              : `Clôture enregistrée — écart : ${formatFCFA(ecart)} FCFA`,
          );
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert('Erreur', e.response?.data?.message ?? 'Échec');
        },
      },
    );
  };

  if (!user) return null;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouvelle clôture" subtitle="Fin de journée" />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 gap-3">
          {/* Date */}
          <DatePickerField
            label="Date de clôture *"
            value={dateCloture}
            onChange={setDateCloture}
          />

          {/* Récap calculé */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Récapitulatif du jour
            </Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                Total livré
              </Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatFCFA(stats.totalLivre)} F
              </Text>
            </View>
            <View className="flex-row justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
              <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                Total encaissé
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                {formatFCFA(stats.totalEncaisse)} FCFA
              </Text>
            </View>
          </View>

          {/* Montant remis */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Montant remis (FCFA) *
            </Text>
            <TextInput
              value={montantRemis}
              onChangeText={setMontantRemis}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
            <Pressable
              onPress={() => setMontantRemis(String(stats.totalEncaisse))}
              className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
            >
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                Remettre tout l'encaissé ({formatFCFA(stats.totalEncaisse)})
              </Text>
            </Pressable>
          </View>

          {/* Écart calculé */}
          {remisNum > 0 ? (
            <View
              className={`rounded-md p-3 flex-row items-center gap-2 border ${
                balanced
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
              }`}
            >
              {balanced ? (
                <CheckCircle2 color="#059669" size={18} />
              ) : (
                <AlertTriangle color="#d97706" size={18} />
              )}
              <View className="flex-1">
                <Text
                  className={`text-[12px] font-bold ${
                    balanced
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {balanced
                    ? 'Caisse équilibrée'
                    : ecart > 0
                    ? `Excédent : +${formatFCFA(ecart)} FCFA`
                    : `Manque : ${formatFCFA(ecart)} FCFA`}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Commentaire */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Commentaire (optionnel)
            </Text>
            <TextInput
              value={commentaire}
              onChangeText={setCommentaire}
              multiline
              placeholder="Ex : retard livraison, écart -1000 (rendu monnaie client)"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-3 items-center active:opacity-80"
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Enregistrer la clôture
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
