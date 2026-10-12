import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Check, MessageSquareWarning } from 'lucide-react-native';
import { StatutRemiseBadge } from './StatutRemiseBadge';
import { useConfirmerRemise, useContesterRemise } from '../../features/remises-argent/hooks';
import {
  COMMENTAIRE_REMISE_MAX,
  construireContestation,
  nomLivreur,
  peutDecider,
} from '../../features/remises-argent/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { num } from '../../features/encaissements/regles';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';
import { formatDateShort, formatMontant } from '../../lib/format';
import type { RemiseArgentResponse } from '../../types/api';

/**
 * Carte d'une remise d'argent : référence, date, montant, badge de statut,
 * apprenti (côté principal), commentaire et motif de contestation.
 * `actions` s'affiche sous la carte.
 */
export function RemiseArgentCarte({
  remise,
  avecApprenti = false,
  actions,
}: {
  remise: RemiseArgentResponse;
  avecApprenti?: boolean;
  actions?: ReactNode;
}) {
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">{remise.reference}</Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {formatDateShort(remise.dateRemise)}
            {avecApprenti ? ` · ${nomLivreur(remise.apprenti)}` : ''}
          </Text>
        </View>
        <View className="items-end gap-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">
            {formatMontant(num(remise.montant))} FCFA
          </Text>
          <StatutRemiseBadge statut={remise.statut} />
        </View>
      </View>
      {remise.commentaire ? (
        <Text className="text-[12px] text-slate-600 dark:text-slate-300 mt-2">{remise.commentaire}</Text>
      ) : null}
      {remise.statut === 'CONTESTEE' && remise.motifContestation ? (
        <Text className="text-[12px] text-red-700 dark:text-red-400 font-bold mt-2">
          Motif : {remise.motifContestation}
        </Text>
      ) : null}
      {actions ? <View className="flex-row gap-2 mt-3">{actions}</View> : null}
    </View>
  );
}

/** Bouton d'action d'une carte de remise. */
export function ActionRemise({
  libelle,
  icone,
  couleur,
  disabled,
  onPress,
}: {
  libelle: string;
  icone?: ReactNode;
  couleur: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`flex-1 flex-row items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 rounded-md py-2 active:opacity-70 ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      {icone}
      <Text className={`text-[12px] font-bold ${couleur}`}>{libelle}</Text>
    </Pressable>
  );
}

/**
 * Décisions du principal sur une remise déclarée : Confirmer (avec
 * confirmation) ou Contester (motif obligatoire, saisi dans une fenêtre).
 * Envois protégés par `lancerUneFois`. L'écran rend `dialogue`.
 */
export function useDecisionRemise() {
  const mConfirmer = useConfirmerRemise();
  const mContester = useContesterRemise();
  const verrou = useRef(creerVerrou()).current;
  const [aContester, setAContester] = useState<RemiseArgentResponse | null>(null);
  const enCours = mConfirmer.isPending || mContester.isPending;

  const confirmer = (r: RemiseArgentResponse) =>
    dialog.confirm({
      title: 'Confirmer cette remise ?',
      message: `${r.reference} · ${formatMontant(num(r.montant))} FCFA remis par ${nomLivreur(r.apprenti)}.`,
      confirmLabel: 'Confirmer',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mConfirmer.mutate(r.id, {
            onSuccess: () => dialog.success('Remise confirmée', r.reference),
            onError: (e) =>
              dialog.error('Confirmation impossible', extractApiErrorMessage(e, 'La remise n’a pas pu être confirmée.')),
            onSettled: fin,
          }),
        ),
    });

  const envoyerContestation = (motif: string, setErreur: (e: string | null) => void) => {
    const r = aContester;
    if (!r) return;
    const c = construireContestation(motif);
    if (!c.ok) {
      setErreur(c.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      mContester.mutate(
        { id: r.id, motif: c.valeur.motif },
        {
          onSuccess: () => {
            setAContester(null);
            dialog.success('Remise contestée', r.reference);
          },
          onError: (e) => setErreur(extractApiErrorMessage(e, 'La remise n’a pas pu être contestée.')),
          onSettled: fin,
        },
      ),
    );
  };

  const actions = (r: RemiseArgentResponse) =>
    peutDecider(r) ? (
      <>
        <ActionRemise
          libelle="Confirmer"
          icone={<Check color="#059669" size={14} />}
          couleur="text-emerald-700 dark:text-emerald-400"
          disabled={enCours}
          onPress={() => confirmer(r)}
        />
        <ActionRemise
          libelle="Contester"
          icone={<MessageSquareWarning color="#dc2626" size={14} />}
          couleur="text-red-600 dark:text-red-400"
          disabled={enCours}
          onPress={() => setAContester(r)}
        />
      </>
    ) : null;

  const dialogue = (
    <ContestationDialog
      key={aContester?.id ?? 'aucune'}
      remise={aContester}
      enCours={mContester.isPending}
      onFermer={() => {
        if (!mContester.isPending) setAContester(null);
      }}
      onEnvoyer={envoyerContestation}
    />
  );

  return { actions, dialogue, enCours };
}

function ContestationDialog({
  remise,
  enCours,
  onFermer,
  onEnvoyer,
}: {
  remise: RemiseArgentResponse | null;
  enCours: boolean;
  onFermer: () => void;
  onEnvoyer: (motif: string, setErreur: (e: string | null) => void) => void;
}) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);

  return (
    <Modal visible={!!remise} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <Pressable
            onPress={onFermer}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityLabel="Fermer"
          />
          {remise ? (
            <View
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl self-center w-full"
              style={{ maxWidth: 420, maxHeight: '90%' }}
            >
              <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <Text className="text-lg font-extrabold text-slate-900 dark:text-white">Contester la remise</Text>
                <Text className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">
                  {remise.reference} · {formatMontant(num(remise.montant))} FCFA · {nomLivreur(remise.apprenti)}
                </Text>
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2">
                  Motif (obligatoire)
                </Text>
                <TextInput
                  value={motif}
                  onChangeText={(v) => {
                    setMotif(v);
                    setErreur(null);
                  }}
                  multiline
                  maxLength={COMMENTAIRE_REMISE_MAX}
                  placeholder="Ex. il manque 500 FCFA"
                  placeholderTextColor="#94a3b8"
                  accessibilityLabel="Motif de la contestation"
                  className="min-h-[72px] px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1">
                  {motif.length}/{COMMENTAIRE_REMISE_MAX}
                </Text>
                {erreur ? (
                  <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold mt-2">{erreur}</Text>
                ) : null}
                <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-3">
                  L’apprenti verra le motif et pourra déclarer une nouvelle remise.
                </Text>
                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={onFermer}
                    disabled={enCours}
                    className="flex-1 py-3 rounded-xl items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:opacity-80"
                  >
                    <Text className="font-extrabold text-[15px] text-slate-700 dark:text-slate-200">Annuler</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => onEnvoyer(motif, setErreur)}
                    disabled={enCours}
                    accessibilityRole="button"
                    className={`flex-1 py-3 rounded-xl items-center justify-center bg-red-500 active:opacity-80 ${
                      enCours ? 'opacity-60' : ''
                    }`}
                  >
                    {enCours ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text className="font-extrabold text-[15px] text-white">Envoyer la contestation</Text>
                    )}
                  </Pressable>
                </View>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
