import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';
import { Check } from 'lucide-react-native';
import { PageHeader } from '../../../../../components/shared/PageHeader';
import { FormScreen } from '../../../../../components/shared/FormScreen';
import { DatePickerField } from '../../../../../components/shared/DatePickerField';
import { ChampTexte } from '../../../../../components/fournisseur/ChampTexte';
import {
  lireMontantVersementClient,
  MODES_VERSEMENT_CLIENT,
  useClientsFournisseur,
  useEnregistrerVersementClient,
} from '../../../../../features/fournisseur/clients';
import { creerVerrou, lancerUneFois } from '../../../../../features/commandes/verrou';
import { useNetworkStore } from '../../../../../stores/networkStore';
import { dialog } from '../../../../../lib/dialog';
import { extractApiErrorMessage } from '../../../../../lib/api-error';
import { formatFCFA } from '../../../../../lib/format';
import { retourParent } from '../../../../../lib/navigation-app';
import { jourIso } from '../../../../../lib/periode';
import type { ModeVersementClient } from '../../../../../types/api';

/**
 * Argent → Mes clients → Versement : un client paie le fournisseur (seul le
 * fournisseur enregistre l'argent des clients). Montant > 0, date, mode
 * (Espèces, Mobile Money, Virement, Autre), commentaire facultatif.
 */
export default function VersementDuClient() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pathname = usePathname();
  const client = useClientsFournisseur().data?.find((c) => c.id === id);
  const m = useEnregistrerVersementClient();
  const isOnline = useNetworkStore((s) => s.isOnline);
  const verrou = useRef(creerVerrou()).current;
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState<string | null>(() => jourIso(new Date()));
  const [mode, setMode] = useState<ModeVersementClient>('ESPECES');
  const [commentaire, setCommentaire] = useState('');

  const envoyer = () => {
    const lecture = lireMontantVersementClient(montant);
    if (!lecture.ok) {
      dialog.warning('Champ invalide', lecture.erreur);
      return;
    }
    const payload = {
      montant: lecture.valeur,
      date: date ?? undefined,
      mode,
      commentaire: commentaire.trim() || undefined,
    };
    lancerUneFois(verrou, (fin) =>
      m.mutate(
        { clientId: id!, payload },
        {
          onSuccess: () => {
            retourParent(pathname);
            dialog.success('Versement enregistré');
          },
          onError: (e) => dialog.error('Erreur', extractApiErrorMessage(e, "Impossible d'enregistrer ce versement")),
          onSettled: fin,
        },
      ),
    );
  };

  const actif = isOnline && !m.isPending;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader
        title={client ? `Versement de ${client.nom}` : 'Versement du client'}
        subtitle={client ? `Dû actuel : ${formatFCFA(client.du)} F` : 'Le versement réduit son dû'}
      />
      <FormScreen>
        <View className="px-4 pt-3 gap-3">
          <ChampTexte
            label="Montant du versement"
            value={montant}
            onChangeText={setMontant}
            keyboardType="decimal-pad"
            placeholder="0"
            aide="Montant en FCFA, supérieur à 0"
          />
          <DatePickerField label="Date du versement" value={date} onChange={setDate} maximumDate={new Date()} />
          <View>
            <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mb-2">
              Mode de paiement
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MODES_VERSEMENT_CLIENT.map((o) => {
                const choisi = o.valeur === mode;
                return (
                  <Pressable
                    key={o.valeur}
                    onPress={() => setMode(o.valeur)}
                    accessibilityRole="button"
                    accessibilityLabel={`Mode ${o.label}`}
                    accessibilityState={{ selected: choisi }}
                    className={`px-3 py-2 rounded-md border active:opacity-70 ${
                      choisi ? 'bg-emerald-700 border-emerald-700' : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <Text className={`text-[12px] font-bold ${choisi ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <ChampTexte
            label="Commentaire"
            value={commentaire}
            onChangeText={setCommentaire}
            maxLength={500}
            placeholder="ex : solde du mois"
          />
          <Pressable
            onPress={envoyer}
            disabled={!actif}
            accessibilityRole="button"
            accessibilityLabel="Enregistrer le versement"
            className={`rounded-md py-3.5 mt-3 flex-row items-center justify-center gap-2 ${actif ? 'bg-emerald-700 active:opacity-80' : 'bg-slate-300 dark:bg-slate-800'}`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Check color="#fff" size={16} />
                <Text className="text-white font-bold text-base">Enregistrer le versement</Text>
              </>
            )}
          </Pressable>
        </View>
      </FormScreen>
    </View>
  );
}
