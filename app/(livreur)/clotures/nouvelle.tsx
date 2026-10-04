import { useState, useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { dialog } from '../../../lib/dialog';
import { CheckCircle2, AlertTriangle } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { useEnregistrerCloture } from '../../../features/clotures/hooks';
import {
  construireCloture,
  ecartCaisse,
  libelleEcart,
  messageClotureEnregistree,
  parseMontantRemis,
  sensEcart,
  totauxEstimesDuJour,
} from '../../../features/clotures/regles';
import { jourLocal } from '../../../features/encaissements/regles';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useEncaissementsByLivreur } from '../../../features/encaissements/hooks';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { formatMontant } from '../../../lib/format';

/**
 * Formulaire « Nouvelle clôture journalière ».
 *
 * Le serveur calcule et fige les totaux : dû net des livraisons du jour,
 * encaissé du jour, et l'écart = encaissé − remis (positif = manque en
 * caisse). L'écran n'en montre qu'une **estimation** (cache local, mêmes
 * définitions) ; le dialogue de succès affiche les valeurs retournées.
 */
export default function NouvelleCloture() {
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';
  const today = jourLocal(new Date());

  const [dateCloture, setDateCloture] = useState<string | null>(today);
  const [montantRemis, setMontantRemis] = useState('');
  const [commentaire, setCommentaire] = useState('');

  const livQ = useLivraisonsByLivreur(livreurId);
  const encQ = useEncaissementsByLivreur(livreurId);
  const m = useEnregistrerCloture();

  const estimation = useMemo(
    () => totauxEstimesDuJour(dateCloture ?? today, livQ.data ?? [], encQ.data ?? []),
    [dateCloture, today, livQ.data, encQ.data],
  );

  const remis = parseMontantRemis(montantRemis);
  const ecartEstime = remis.ok ? ecartCaisse(estimation.totalEncaisse, remis.valeur) : null;
  const sens = ecartEstime == null ? null : sensEcart(ecartEstime);

  const onSubmit = () => {
    if (!user || m.isPending) return;
    if (!isOnline) {
      dialog.warning('Hors ligne', 'La clôture nécessite une connexion. Réessaye une fois en ligne.');
      return;
    }
    const req = construireCloture({
      livreurId: user.id,
      dateCloture,
      montantRemis,
      commentaire,
    });
    if (!req.ok) {
      dialog.warning('Saisie incomplète', req.erreur);
      return;
    }
    m.mutate(req.valeur, {
      onSuccess: (cloture) => {
        router.back();
        dialog.success('Clôture enregistrée', messageClotureEnregistree(cloture));
      },
      onError: (err: unknown) => {
        dialog.error('Erreur', extractApiErrorMessage(err, 'Échec de la clôture'));
      },
    });
  };

  if (!user) return null;

  const desactive = m.isPending || !isOnline || !remis.ok;

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
            maximumDate={new Date()}
          />

          {/* Récap estimé */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-3">
              Récapitulatif du jour (estimation)
            </Text>
            <View className="flex-row justify-between mb-2">
              <Text className="text-[12px] text-slate-500 dark:text-slate-400">
                Total livré (dû)
              </Text>
              <Text className="font-bold text-slate-700 dark:text-slate-300">
                {formatMontant(estimation.totalDu)} F
              </Text>
            </View>
            <View className="flex-row justify-between border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
              <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                Total encaissé
              </Text>
              <Text className="font-extrabold text-emerald-600 dark:text-emerald-400 text-base">
                {formatMontant(estimation.totalEncaisse)} FCFA
              </Text>
            </View>
            <Text className="text-[10px] text-slate-400 mt-2">
              Estimation sur les données de l'appareil : les totaux définitifs sont calculés par le serveur à l'enregistrement.
            </Text>
          </View>

          {/* Montant remis */}
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Montant remis (FCFA) *
            </Text>
            <TextInput
              value={montantRemis}
              onChangeText={setMontantRemis}
              keyboardType="decimal-pad"
              selectTextOnFocus
              placeholder="0"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white text-2xl font-extrabold"
            />
            <Pressable
              onPress={() => setMontantRemis(String(estimation.totalEncaisse))}
              className="self-start bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md mt-2 active:opacity-70"
            >
              <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                Remettre tout l'encaissé ({formatMontant(estimation.totalEncaisse)})
              </Text>
            </Pressable>
            {montantRemis.trim() !== '' && !remis.ok ? (
              <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">{remis.erreur}</Text>
            ) : null}
          </View>

          {/* Écart estimé (signe du back : encaissé − remis) */}
          {ecartEstime != null && sens ? (
            <View
              className={`rounded-md p-3 flex-row items-center gap-2 border ${
                sens === 'equilibre'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30'
                  : 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30'
              }`}
            >
              {sens === 'equilibre' ? (
                <CheckCircle2 color="#059669" size={18} />
              ) : (
                <AlertTriangle color="#d97706" size={18} />
              )}
              <View className="flex-1">
                <Text
                  className={`text-[12px] font-bold ${
                    sens === 'equilibre'
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {libelleEcart(ecartEstime)} (estimation)
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
              placeholder="Ex : retard livraison, manque 1000 (rendu monnaie client)"
              placeholderTextColor="#94a3b8"
              className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md text-slate-900 dark:text-white min-h-[80px]"
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={onSubmit}
            disabled={desactive}
            className={`rounded-md py-3.5 mt-3 items-center ${
              !isOnline || !remis.ok
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  !isOnline || !remis.ok ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : !remis.ok
                  ? 'Saisis le montant remis'
                  : 'Enregistrer la clôture'}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
