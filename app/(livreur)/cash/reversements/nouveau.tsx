import { useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { dialog } from '../../../../lib/dialog';
import { Building2, Users } from 'lucide-react-native';
import { PageHeader } from '../../../../components/shared/PageHeader';
import { DatePickerField } from '../../../../components/shared/DatePickerField';
import { useEnregistrerReversement } from '../../../../features/reversements/hooks';
import {
  construireReversement,
  periodeDepuisParams,
} from '../../../../features/reversements/regles';
import { jourLocal, num, parseMontant } from '../../../../features/encaissements/regles';
import { useNetworkStore } from '../../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../../lib/api-error';
import { formatMontant } from '../../../../lib/format';
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
  const submittingRef = useRef(false);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const today = jourLocal(new Date());

  const type: BeneficiaireType = params.type === 'FOURNISSEUR' ? 'FOURNISSEUR' : 'CLIENT';
  const beneficiaireLabel = params.label ?? 'Bénéficiaire';
  const initialMontant = params.montantSuggere ?? '';
  const [montant, setMontant] = useState(initialMontant);
  const [dateRev, setDateRev] = useState<string | null>(today);
  const [commentaire, setCommentaire] = useState('');

  // Période (mois civil) reçue de la synthèse ; jamais un mois à venir.
  const periode = periodeDepuisParams(params.mois, params.annee);
  const { mois, annee } = periode;
  const saisie = parseMontant(montant);
  const suggestion = parseMontant(initialMontant);

  const onSubmit = () => {
    // Ref (pas `m.isPending`, figé dans la closure) : bloque un double appui.
    if (submittingRef.current || m.isPending) return;
    if (!isOnline) {
      dialog.warning('Hors ligne', 'Le reversement nécessite une connexion. Réessaye une fois en ligne.');
      return;
    }
    const req = construireReversement({
      type,
      beneficiaireId: params.beneficiaireId,
      montant,
      periode,
      dateReversement: dateRev,
      aujourdhui: today,
      commentaire,
    });
    if (!req.ok) {
      dialog.warning('Saisie invalide', req.erreur);
      return;
    }
    submittingRef.current = true;
    m.mutate(req.valeur, {
      onSettled: () => {
        submittingRef.current = false;
      },
      onSuccess: (r) => {
        router.back();
        dialog.success(
          'Reversement enregistré',
          `${formatMontant(num(r.montant))} FCFA — période ${String(r.periodeMois).padStart(2, '0')}/${r.periodeAnnee}`,
        );
      },
      onError: (err: unknown) => {
        // Plafond (reste à reverser), mois à venir, date future : message du back.
        dialog.error('Erreur', extractApiErrorMessage(err, 'Échec du reversement'));
      },
    });
  };

  const desactive = m.isPending || !isOnline || !saisie.ok;

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
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
            {suggestion.ok ? (
              <Pressable
                onPress={() => setMontant(initialMontant)}
                className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
              >
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  Tout le reste à reverser ({formatMontant(suggestion.valeur)})
                </Text>
              </Pressable>
            ) : null}
            {type === 'CLIENT' ? (
              <Text className="text-[10px] text-slate-400 mt-2">
                Plafonné au reste à reverser de la période et au reste actuel du client (le plus petit des deux).
              </Text>
            ) : null}
            {montant.trim() !== '' && !saisie.ok ? (
              <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">{saisie.erreur}</Text>
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
            maximumDate={new Date()}
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
            disabled={desactive}
            className={`rounded-md py-3.5 mt-3 items-center ${
              !isOnline || !saisie.ok
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || !saisie.ok ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : !saisie.ok
                  ? 'Saisis un montant'
                  : `Reverser ${formatMontant(saisie.valeur)} FCFA`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
