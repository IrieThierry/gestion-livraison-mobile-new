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
import { ArrowRight, Check, Undo2, X } from 'lucide-react-native';
import { StatutTransfertBadge } from './StatutTransfertBadge';
import {
  useAccepterTransfert,
  useAnnulerTransfert,
  useRefuserTransfert,
} from '../../features/transferts/hooks';
import {
  construireRefus,
  messageAnnulationTransfert,
  MOTIF_REFUS_MAX,
  nomLivreurTransfert,
  peutAnnulerTransfert,
  peutDeciderTransfert,
  TITRE_ANNULATION_TRANSFERT,
} from '../../features/transferts/regles';
import { creerVerrou, lancerUneFois } from '../../features/commandes/verrou';
import { extractApiErrorMessage } from '../../lib/api-error';
import { dialog } from '../../lib/dialog';
import { formatDateShort } from '../../lib/format';
import type { TransfertStockResponse, UUID } from '../../types/api';

/**
 * Carte d'un transfert de stock : produit × quantité, source → destinataire,
 * date, badge de statut, mention « Reprise », commentaire et motif du refus.
 * `actions` s'affiche sous la carte.
 */
export function TransfertCarte({ transfert: t, actions }: { transfert: TransfertStockResponse; actions?: ReactNode }) {
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3">
      <View className="flex-row items-start gap-2">
        <View className="flex-1">
          <Text className="font-extrabold text-slate-900 dark:text-white">
            {t.produit?.designation ?? '—'} × {t.qte}
          </Text>
          <View className="flex-row items-center gap-1 mt-1 flex-wrap">
            <Text className="text-[12px] text-slate-700 dark:text-slate-300">{nomLivreurTransfert(t.source)}</Text>
            <ArrowRight color="#10b981" size={12} />
            <Text className="text-[12px] text-slate-700 dark:text-slate-300">
              {nomLivreurTransfert(t.destinataire)}
            </Text>
          </View>
        </View>
        <View className="items-end gap-1">
          <StatutTransfertBadge statut={t.statut} />
          {t.reprise ? (
            <Text className="text-[10px] font-bold text-violet-700 dark:text-violet-300">Reprise</Text>
          ) : null}
        </View>
      </View>
      <Text className="text-[10px] text-slate-400 mt-1">
        {formatDateShort(t.dateTransfert)}
        {t.commentaire ? ` · ${t.commentaire}` : ''}
      </Text>
      {t.statut === 'REFUSE' && t.motifRefus ? (
        <Text className="text-[12px] text-red-700 dark:text-red-400 font-bold mt-2">Motif : {t.motifRefus}</Text>
      ) : null}
      {actions ? <View className="flex-row gap-2 mt-3">{actions}</View> : null}
    </View>
  );
}

function ActionTransfert({
  libelle,
  icone,
  couleur,
  disabled,
  onPress,
}: {
  libelle: string;
  icone: ReactNode;
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
 * Actions sur un transfert en attente, selon le rôle du livreur connecté :
 * le décideur Accepte (confirmation) ou Refuse (motif obligatoire, dans une
 * fenêtre) ; l'initiateur Annule (confirmation). Envois protégés par
 * `lancerUneFois`. L'écran rend `dialogue`. `annulation: false` : pas
 * d'« Annuler » (responsable sur le mobile, qui ne fait qu'accepter ou refuser).
 */
export function useDecisionTransfert(moiId: UUID | undefined, { annulation = true }: { annulation?: boolean } = {}) {
  const mAccepter = useAccepterTransfert();
  const mRefuser = useRefuserTransfert();
  const mAnnuler = useAnnulerTransfert();
  const verrou = useRef(creerVerrou()).current;
  const [aRefuser, setARefuser] = useState<TransfertStockResponse | null>(null);
  const enCours = mAccepter.isPending || mRefuser.isPending || mAnnuler.isPending;

  const quoi = (t: TransfertStockResponse) => `${t.qte} × ${t.produit?.designation ?? '—'}`;

  const accepter = (t: TransfertStockResponse) =>
    dialog.confirm({
      title: 'Accepter ce transfert ?',
      message: t.reprise
        ? `${nomLivreurTransfert(t.destinataire)} reprend ${quoi(t)} : la quantité sortira de ton stock.`
        : `${quoi(t)} envoyé par ${nomLivreurTransfert(t.source)} : la quantité entrera dans ton stock.`,
      confirmLabel: 'Accepter',
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mAccepter.mutate(t.id, {
            onSuccess: () => dialog.success('Transfert accepté', quoi(t)),
            onError: (e) =>
              dialog.error('Acceptation impossible', extractApiErrorMessage(e, 'Impossible d’accepter le transfert.')),
            onSettled: fin,
          }),
        ),
    });

  const annuler = (t: TransfertStockResponse) =>
    dialog.confirm({
      title: TITRE_ANNULATION_TRANSFERT,
      message: messageAnnulationTransfert(t),
      confirmLabel: 'Annuler le transfert',
      cancelLabel: 'Garder',
      destructive: true,
      onConfirm: () =>
        lancerUneFois(verrou, (fin) =>
          mAnnuler.mutate(t.id, {
            onSuccess: () => dialog.success('Transfert annulé', quoi(t)),
            onError: (e) =>
              dialog.error('Annulation impossible', extractApiErrorMessage(e, 'Impossible d’annuler le transfert.')),
            onSettled: fin,
          }),
        ),
    });

  const envoyerRefus = (motif: string, setErreur: (e: string | null) => void) => {
    const t = aRefuser;
    if (!t) return;
    const r = construireRefus(motif);
    if (!r.ok) {
      setErreur(r.erreur);
      return;
    }
    setErreur(null);
    lancerUneFois(verrou, (fin) =>
      mRefuser.mutate(
        { id: t.id, motif: r.valeur.motif },
        {
          onSuccess: () => {
            setARefuser(null);
            dialog.success('Transfert refusé', quoi(t));
          },
          onError: (e) => setErreur(extractApiErrorMessage(e, 'Impossible de refuser le transfert.')),
          onSettled: fin,
        },
      ),
    );
  };

  const actions = (t: TransfertStockResponse) => {
    if (peutDeciderTransfert(t, moiId)) {
      return (
        <>
          <ActionTransfert
            libelle="Accepter"
            icone={<Check color="#059669" size={14} />}
            couleur="text-emerald-700 dark:text-emerald-400"
            disabled={enCours}
            onPress={() => accepter(t)}
          />
          <ActionTransfert
            libelle="Refuser"
            icone={<X color="#dc2626" size={14} />}
            couleur="text-red-600 dark:text-red-400"
            disabled={enCours}
            onPress={() => setARefuser(t)}
          />
        </>
      );
    }
    if (annulation && peutAnnulerTransfert(t, moiId)) {
      return (
        <ActionTransfert
          libelle="Annuler"
          icone={<Undo2 color="#64748b" size={14} />}
          couleur="text-slate-700 dark:text-slate-300"
          disabled={enCours}
          onPress={() => annuler(t)}
        />
      );
    }
    return null;
  };

  const dialogue = (
    <RefusDialog
      key={aRefuser?.id ?? 'aucun'}
      transfert={aRefuser}
      enCours={mRefuser.isPending}
      onFermer={() => {
        if (!mRefuser.isPending) setARefuser(null);
      }}
      onEnvoyer={envoyerRefus}
    />
  );

  return { actions, dialogue, enCours };
}

function RefusDialog({
  transfert,
  enCours,
  onFermer,
  onEnvoyer,
}: {
  transfert: TransfertStockResponse | null;
  enCours: boolean;
  onFermer: () => void;
  onEnvoyer: (motif: string, setErreur: (e: string | null) => void) => void;
}) {
  const [motif, setMotif] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const retour = transfert?.reprise
    ? 'Le stock reste chez toi.'
    : 'La quantité revient dans le stock de l’expéditeur.';

  return (
    <Modal visible={!!transfert} transparent animationType="fade" onRequestClose={onFermer} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', paddingHorizontal: 20 }}
        >
          <Pressable
            onPress={onFermer}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            accessibilityLabel="Fermer"
          />
          {transfert ? (
            <View
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl self-center w-full"
              style={{ maxWidth: 420, maxHeight: '90%' }}
            >
              <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
                <Text className="text-lg font-extrabold text-slate-900 dark:text-white">Refuser le transfert</Text>
                <Text className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">
                  {transfert.qte} × {transfert.produit?.designation ?? '—'}. {retour} Ton motif sera visible par
                  l’autre livreur.
                </Text>
                <Text className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400 mt-4 mb-2">
                  Motif
                </Text>
                <TextInput
                  value={motif}
                  onChangeText={(v) => {
                    setMotif(v);
                    setErreur(null);
                  }}
                  multiline
                  maxLength={MOTIF_REFUS_MAX}
                  placeholder="Ex. je n’ai pas demandé ce produit"
                  placeholderTextColor="#94a3b8"
                  accessibilityLabel="Motif du refus"
                  className="min-h-[72px] px-3 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-base"
                  style={{ textAlignVertical: 'top' }}
                />
                <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-right mt-1">
                  {motif.length}/{MOTIF_REFUS_MAX}
                </Text>
                {erreur ? (
                  <Text className="text-[12px] text-red-600 dark:text-red-400 font-bold mt-2">{erreur}</Text>
                ) : null}
                <View className="flex-row gap-2 mt-4">
                  <Pressable
                    onPress={onFermer}
                    disabled={enCours}
                    className="flex-1 py-3 rounded-xl items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 active:opacity-80"
                  >
                    <Text className="font-extrabold text-[15px] text-slate-700 dark:text-slate-200">Fermer</Text>
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
                      <Text className="font-extrabold text-[15px] text-white">Refuser</Text>
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
