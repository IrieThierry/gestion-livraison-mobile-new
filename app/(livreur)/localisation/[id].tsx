import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { PageHeader } from '../../../components/shared/PageHeader';
import { lireUnePosition } from '../../../features/localisation/gps';
import { heure } from '../../../features/localisation/etat';
import {
  useAccepterLocalisation,
  useDemandesRecues,
  useRefuserLocalisation,
} from '../../../features/localisation/hooks';
import { extractApiErrorMessage } from '../../../lib/api-error';

const ENVOI_IMPOSSIBLE = 'Envoi impossible, réessaie';
const MESSAGES_GPS: Record<string, string> = {
  PERMISSION: 'Autorise la localisation pour partager ta position',
  DELAI: 'Position introuvable, réessaie',
};

type Issue = 'partagee' | 'refusee' | 'close';

/**
 * Erreur d'envoi : sans réponse du serveur (réseau) ou erreur serveur → « Envoi impossible,
 * réessaie » (la demande reste ouverte) ; refus métier (expirée, déjà répondue, pas la cible) →
 * message du back et demande close, sauf « Position invalide. » qui se réessaie.
 */
function lireErreurEnvoi(e: unknown): { message: string; close: boolean } {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (!status || status >= 500) return { message: ENVOI_IMPOSSIBLE, close: false };
  const message = extractApiErrorMessage(e, ENVOI_IMPOSSIBLE);
  return { message, close: message !== 'Position invalide.' };
}

/**
 * Écran de réponse de la cible : le demandeur, l'heure, et deux boutons. « Partager ma position »
 * fait une seule lecture GPS (permission demandée maintenant, 15 s au plus) puis l'envoie ; chaque
 * nouvel essai relit le GPS (jamais une position ancienne). Demande absente des demandes reçues :
 * expirée ou déjà traitée.
 */
export default function RepondreLocalisation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useDemandesRecues();
  const accepter = useAccepterLocalisation();
  const refuser = useRefuserLocalisation();
  const [lecture, setLecture] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);

  const demande = (q.data ?? []).find((d) => d.id === id);
  const occupe = lecture || accepter.isPending || refuser.isPending;

  const onPartager = async () => {
    if (!demande || occupe) return;
    setErreur(null);
    setLecture(true);
    let position: string;
    try {
      position = await lireUnePosition();
    } catch (e) {
      setErreur(MESSAGES_GPS[(e as Error)?.message] ?? MESSAGES_GPS.DELAI);
      setLecture(false);
      return;
    }
    setLecture(false);
    accepter.mutate(
      { id: demande.id, position },
      {
        onSuccess: () => setIssue('partagee'),
        onError: (e) => {
          const { message, close } = lireErreurEnvoi(e);
          setErreur(message);
          if (close) setIssue('close');
        },
      },
    );
  };

  const onRefuser = () => {
    if (!demande || occupe) return;
    setErreur(null);
    refuser.mutate(demande.id, {
      onSuccess: () => setIssue('refusee'),
      onError: (e) => {
        const { message, close } = lireErreurEnvoi(e);
        setErreur(message);
        if (close) setIssue('close');
      },
    });
  };

  const contenu = () => {
    if (issue === 'partagee') return <Message texte="Position partagée." ton="ok" />;
    if (issue === 'refusee') return <Message texte="Demande refusée." ton="neutre" />;
    if (issue === 'close') return erreur ? <Message texte={erreur} ton="erreur" /> : null;
    if (q.isLoading) return <ActivityIndicator color="#047857" className="mt-8" />;
    if (q.isError) {
      return <Message texte={extractApiErrorMessage(q.error, 'Impossible de charger la demande.')} ton="erreur" />;
    }
    if (!demande) return <Message texte="Cette demande a expiré ou a déjà reçu une réponse." ton="neutre" />;
    return (
      <>
        <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4 items-center">
          <View className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-500/10 items-center justify-center">
            <MapPin color="#047857" size={22} />
          </View>
          <Text className="font-extrabold text-slate-900 dark:text-white text-base mt-3 text-center">
            {demande.demandeurNom} demande ta position
          </Text>
          <Text className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">
            Demandée à {heure(demande.creeLe)} · expire à {heure(demande.expireLe)}
          </Text>
          <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
            Ta position est lue une seule fois et reste visible jusqu’à minuit.
          </Text>
        </View>
        {erreur ? <Text className="text-[12px] text-red-600 dark:text-red-400 mt-3">{erreur}</Text> : null}
        <Pressable
          onPress={onPartager}
          disabled={occupe}
          accessibilityRole="button"
          accessibilityState={{ disabled: occupe }}
          className="flex-row items-center justify-center gap-2 rounded-md py-3 mt-4 bg-emerald-700 active:opacity-80"
        >
          {lecture || accepter.isPending ? <ActivityIndicator color="#fff" /> : null}
          <Text className="text-white font-bold">Partager ma position</Text>
        </Pressable>
        <Pressable
          onPress={onRefuser}
          disabled={occupe}
          accessibilityRole="button"
          accessibilityState={{ disabled: occupe }}
          className="items-center justify-center rounded-md py-3 mt-2 border border-slate-300 dark:border-slate-700 active:opacity-70"
        >
          <Text className="font-bold text-slate-700 dark:text-slate-300">Refuser</Text>
        </Pressable>
      </>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Demande de position" />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>{contenu()}</ScrollView>
    </View>
  );
}

function Message({ texte, ton }: { texte: string; ton: 'ok' | 'neutre' | 'erreur' }) {
  const couleur =
    ton === 'ok'
      ? 'text-emerald-700 dark:text-emerald-400'
      : ton === 'erreur'
        ? 'text-red-600 dark:text-red-400'
        : 'text-slate-600 dark:text-slate-300';
  return (
    <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-4">
      <Text className={`text-center font-bold ${couleur}`}>{texte}</Text>
    </View>
  );
}
