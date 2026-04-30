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
import { router, useLocalSearchParams } from 'expo-router';
import { Building2, Users } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { DatePickerField } from '../../../../components/shared/DatePickerField';
import { useEnregistrerReversement } from '../../../../features/reversements/hooks';
import { formatFCFA } from '../../../../lib/format';
import type { BeneficiaireType } from '../../../../types/api';

export default function NouveauReversement() {
  const params = useLocalSearchParams<{
    type?: string;
    beneficiaireId?: string;
    label?: string;
    montantSuggere?: string;
    mois?: string;
    annee?: string;
  }>();

  const m = useEnregistrerReversement();
  const today = new Date().toISOString().slice(0, 10);
  const now = new Date();

  const type: BeneficiaireType = (params.type as BeneficiaireType) ?? 'CLIENT';
  const beneficiaireLabel = params.label ?? 'Bénéficiaire';
  const initialMontant = params.montantSuggere ?? '';
  const [montant, setMontant] = useState(initialMontant);
  const [dateRev, setDateRev] = useState<string | null>(today);
  const [commentaire, setCommentaire] = useState('');

  const mois = parseInt(params.mois ?? '', 10) || now.getMonth() + 1;
  const annee = parseInt(params.annee ?? '', 10) || now.getFullYear();

  const onSubmit = () => {
    if (!params.beneficiaireId) {
      Alert.alert('Erreur', 'Bénéficiaire manquant');
      return;
    }
    const n = parseInt(montant, 10);
    if (!n || n <= 0) {
      Alert.alert('Erreur', 'Montant invalide');
      return;
    }
    m.mutate(
      {
        type,
        beneficiaireId: params.beneficiaireId,
        montant: n,
        mois,
        annee,
        dateReversement: dateRev ?? undefined,
        commentaire: commentaire.trim() || undefined,
      },
      {
        onSuccess: () => {
          router.back();
          Alert.alert('Succès', 'Reversement enregistré');
        },
        onError: (err: unknown) => {
          const e = err as { response?: { data?: { message?: string } } };
          Alert.alert('Erreur', e.response?.data?.message ?? 'Échec');
        },
      },
    );
  };

  const TypeIcon = type === 'CLIENT' ? Users : Building2;
  const typeColor = type === 'CLIENT' ? '#8b5cf6' : '#3b82f6';
  const typeBg = type === 'CLIENT' ? 'bg-violet-100 dark:bg-violet-500/15' : 'bg-blue-100 dark:bg-blue-500/15';

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Nouveau reversement" subtitle={beneficiaireLabel} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3 gap-3">
          {/* Bénéficiaire */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-3 flex-row items-center gap-3">
            <View className={`w-10 h-10 rounded-full items-center justify-center ${typeBg}`}>
              <TypeIcon color={typeColor} size={18} />
            </View>
            <View className="flex-1">
              <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                {type === 'CLIENT' ? 'Client' : 'Fournisseur'}
              </Text>
              <Text className="font-extrabold text-slate-900 dark:text-white">
                {beneficiaireLabel}
              </Text>
            </View>
          </View>

          {/* Montant */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Montant à reverser (FCFA) *
            </Text>
            <TextInput
              value={montant}
              onChangeText={setMontant}
              keyboardType="number-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
            {initialMontant ? (
              <Pressable
                onPress={() => setMontant(initialMontant)}
                className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
              >
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  Tout rembourser ({formatFCFA(parseInt(initialMontant, 10))})
                </Text>
              </Pressable>
            ) : null}
          </View>

          {/* Période */}
          <View className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-md p-3">
            <Text className="text-[12px] text-amber-700 dark:text-amber-400">
              <Text className="font-bold">Période concernée :</Text> {String(mois).padStart(2, '0')}/{annee}
            </Text>
          </View>

          {/* Date du reversement */}
          <DatePickerField
            label="Date du reversement"
            value={dateRev}
            onChange={setDateRev}
            optional
          />

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
            disabled={m.isPending}
            className="bg-emerald-500 rounded-md py-3.5 mt-3 items-center active:opacity-80"
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
