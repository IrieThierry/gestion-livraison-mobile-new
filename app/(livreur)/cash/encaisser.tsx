import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { dialog } from '../../../lib/dialog';
import { extractApiErrorMessage } from '../../../lib/api-error';
import { useLivraisonsByLivreur } from '../../../features/livraisons/hooks';
import { useClientsByLivreur } from '../../../features/clients/hooks';
import {
  useApercuEncaissement,
  useCreerEncaissement,
  useLivraisonsAEncaisser,
} from '../../../features/encaissements/hooks';
import {
  basculerSelection,
  dateEncaissementParam,
  jourLocal,
  libelleDetteApres,
  libelleEcart,
  num,
  parseMontant,
  peutValiderEncaissement,
  tonEcart,
  totalResteDuSelection,
} from '../../../features/encaissements/regles';
import { useAuthStore } from '../../../stores/authStore';
import { useNetworkStore } from '../../../stores/networkStore';
import { PageHeader } from '../../../components/shared/PageHeader';
import { EmptyState } from '../../../components/shared/EmptyState';
import { DatePickerField } from '../../../components/shared/DatePickerField';
import { formatMontant, formatDateShort } from '../../../lib/format';
import type {
  ApercuEncaissementRequest,
  EncaissementLivraisonResponse,
  UUID,
} from '../../../types/api';

const COULEUR_ECART: Record<ReturnType<typeof tonEcart>, string> = {
  negatif: 'text-amber-700 dark:text-amber-400',
  nul: 'text-slate-700 dark:text-slate-300',
  positif: 'text-emerald-700 dark:text-emerald-400',
};

/**
 * Encaissement d'un paiement client sur des livraisons cochées (E1, E4,
 * E10).
 *
 *   • `clientId` — depuis la fiche / la liste clients ;
 *   • `livraisonId` — depuis une livraison : son client est retenu et la
 *     livraison est pré-cochée.
 *
 * Tout vient du serveur : livraisons avec un reste dû, solde et avance
 * (`GET …/a-encaisser`), puis répartition, écart et surplus imputé
 * (`POST …/apercu`, rappelé après 300 ms d'inactivité). Le montant couvre
 * les livraisons cochées des plus anciennes aux plus récentes ; un reste
 * dû reste une dette, un surplus devient une avance.
 */
export default function EncaisserPage() {
  const params = useLocalSearchParams<{
    livraisonId?: string;
    clientId?: string;
  }>();
  const user = useAuthStore((s) => s.user);
  const isOnline = useNetworkStore((s) => s.isOnline);
  const livreurId = user?.id ?? '';

  const qLiv = useLivraisonsByLivreur(livreurId);
  const qCli = useClientsByLivreur(livreurId);
  const m = useCreerEncaissement();
  const submittingRef = useRef(false);

  const todayIso = jourLocal(new Date());
  const [montant, setMontant] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const [dateEncaissement, setDateEncaissement] = useState<string | null>(todayIso);
  // Livraison d'origine pré-cochée.
  const [selection, setSelection] = useState<UUID[]>(() =>
    params.livraisonId ? [params.livraisonId] : [],
  );

  const mode: 'livraison' | 'client' = params.livraisonId ? 'livraison' : 'client';

  const livraisonOrigine = useMemo(
    () =>
      mode === 'livraison'
        ? (qLiv.data ?? []).find((l) => l.id === params.livraisonId)
        : undefined,
    [mode, qLiv.data, params.livraisonId],
  );

  const clientId =
    mode === 'client' ? params.clientId ?? null : livraisonOrigine?.client.id ?? null;

  const client = useMemo(
    () => (qCli.data ?? []).find((c) => c.id === clientId),
    [qCli.data, clientId],
  );

  const qAEnc = useLivraisonsAEncaisser(livreurId, clientId);
  const aEncaisser = qAEnc.data;
  const livraisons = useMemo(() => aEncaisser?.livraisons ?? [], [aEncaisser]);

  // Livraisons cochées, dans l'ordre serveur (plus anciennes d'abord) ;
  // une livraison pré-cochée sans reste dû n'est pas retenue.
  const livraisonIds = useMemo(
    () => livraisons.filter((l) => selection.includes(l.id)).map((l) => l.id),
    [livraisons, selection],
  );
  const resteCoche = totalResteDuSelection(livraisons, livraisonIds);

  // Montant pré-rempli une seule fois : reste dû des livraisons pré-cochées.
  const prerempli = useRef(false);
  useEffect(() => {
    if (prerempli.current || !aEncaisser) return;
    prerempli.current = true;
    if (resteCoche > 0) setMontant(String(resteCoche));
  }, [aEncaisser, resteCoche]);

  const saisie = parseMontant(montant);
  const montantSaisi = saisie.ok ? saisie.valeur : 0;
  const dateParam = dateEncaissementParam(dateEncaissement, todayIso);

  const apercuPayload = useMemo<ApercuEncaissementRequest | null>(
    () =>
      clientId && livreurId && peutValiderEncaissement(livraisonIds, montantSaisi)
        ? {
            livreurId,
            clientId,
            livraisonIds,
            montantEncaisse: montantSaisi,
            dateEncaissement: dateParam,
          }
        : null,
    [clientId, livreurId, livraisonIds, montantSaisi, dateParam],
  );
  const qApercu = useApercuEncaissement(apercuPayload);
  // L'aperçu n'est montré (et la validation permise) que s'il correspond à la
  // saisie courante : pas pendant le délai de 300 ms ni avec l'ancien aperçu.
  const apercuAJour = !!apercuPayload && qApercu.aJour;
  const apercu = apercuAJour ? qApercu.data : undefined;

  if (!user) return null;

  if (qLiv.isLoading || qCli.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50 dark:bg-slate-950">
        <ActivityIndicator color="#10b981" />
      </View>
    );
  }

  if (mode === 'livraison' && !livraisonOrigine) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Encaisser" />
        <EmptyState
          title="Livraison introuvable"
          message="Reviens à la tournée et choisis une livraison."
        />
      </View>
    );
  }
  if (mode === 'client' && !client) {
    return (
      <View className="flex-1 bg-slate-50 dark:bg-slate-950">
        <PageHeader title="Encaisser" />
        <EmptyState
          title="Client introuvable"
          message="Ce client n'est plus dans ta liste."
        />
      </View>
    );
  }

  const clientName = client
    ? `${client.prenom} ${client.nom ?? ''}`.trim()
    : livraisonOrigine
    ? `${livraisonOrigine.client.prenom} ${livraisonOrigine.client.nom ?? ''}`.trim()
    : 'Client';

  const peutValider = peutValiderEncaissement(livraisonIds, montantSaisi);

  const messageApres = (enc: EncaissementLivraisonResponse): string => {
    const apres = num(enc.detteApres);
    const solde =
      apres > 0
        ? `Reste dû par le client : ${formatMontant(apres)} FCFA`
        : apres < 0
        ? `Avance du client : ${formatMontant(-apres)} FCFA`
        : 'Le client est à jour.';
    return `${libelleEcart(num(enc.ecart))}. ${solde}`;
  };

  const onSubmit = () => {
    // Ref (pas `m.isPending`, figé dans la closure) : bloque un double appui
    // qui créerait deux encaissements.
    if (submittingRef.current || m.isPending || !apercuAJour) return;
    if (!clientId) {
      dialog.error('Erreur', 'Client invalide');
      return;
    }
    if (!isOnline) {
      dialog.warning('Hors ligne', "L'encaissement nécessite une connexion. Réessaye une fois en ligne.");
      return;
    }
    if (livraisonIds.length === 0) {
      dialog.warning('Livraisons requises', 'Coche au moins une livraison à encaisser.');
      return;
    }
    if (!saisie.ok) {
      dialog.warning('Montant invalide', saisie.erreur);
      return;
    }
    if (dateEncaissement && dateEncaissement > todayIso) {
      dialog.warning('Date invalide', "La date d'encaissement ne peut pas être dans le futur.");
      return;
    }

    submittingRef.current = true;
    m.mutate(
      {
        livreurId: user.id,
        clientId,
        livraisonIds,
        montantEncaisse: saisie.valeur,
        dateEncaissement: dateParam,
        commentaire: commentaire.trim() || undefined,
      },
      {
        onSettled: () => {
          submittingRef.current = false;
        },
        onSuccess: (enc) => {
          router.back();
          dialog.success('Encaissement enregistré', messageApres(enc), { autoDismissMs: 4000 });
        },
        onError: (err: unknown) => {
          dialog.error('Erreur', extractApiErrorMessage(err, 'Échec de l’encaissement'));
        },
      },
    );
  };

  const solde = num(aEncaisser?.solde);
  const avance = num(aEncaisser?.avance);
  const desactive = m.isPending || !isOnline || !peutValider || !apercuAJour;
  const surplus = apercu?.surplusImpute ?? [];

  return (
    <View className="flex-1 bg-slate-50 dark:bg-slate-950">
      <PageHeader title="Encaisser" subtitle={clientName} />
      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-4 pt-3">
          {/* Solde et avance (serveur) */}
          <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4">
            {qAEnc.isLoading ? (
              <ActivityIndicator color="#10b981" />
            ) : qAEnc.isError ? (
              <Text className="text-[12px] text-red-600 dark:text-red-400">
                {extractApiErrorMessage(qAEnc.error, 'Livraisons à encaisser indisponibles')}
              </Text>
            ) : (
              <>
                <Ligne label="Solde du client" valeur={`${formatMontant(Math.max(0, solde))} F`} />
                <Ligne label="Avance" valeur={`${formatMontant(avance)} F`} />
              </>
            )}
          </View>

          {/* Livraisons à encaisser (reste dû > 0, plus anciennes d'abord) */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Livraisons à encaisser{aEncaisser ? ` (${livraisons.length})` : ''}
          </Text>
          {aEncaisser && livraisons.length === 0 ? (
            <Text className="text-[12px] text-slate-500 dark:text-slate-400">
              Aucune livraison avec un reste dû pour ce client.
            </Text>
          ) : livraisons.length > 0 ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {livraisons.map((l, i) => {
                const cochee = livraisonIds.includes(l.id);
                return (
                  <Pressable
                    key={l.id}
                    onPress={() => setSelection((s) => basculerSelection(s, l.id))}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: cochee }}
                    accessibilityLabel={`Sélectionner ${l.reference}`}
                    className={`px-4 py-3 flex-row items-center gap-3 active:opacity-70 ${
                      i > 0 ? 'border-t border-slate-100 dark:border-slate-800' : ''
                    }`}
                  >
                    <View
                      className={`w-5 h-5 rounded border items-center justify-center ${
                        cochee
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {cochee ? <Check color="#fff" size={14} /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="font-extrabold text-slate-900 dark:text-white text-[13px]">
                        {l.reference}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-slate-400">
                        {formatDateShort(l.date)}
                        {num(l.paye) > 0 ? ` · payé ${formatMontant(num(l.paye))}` : ''}
                      </Text>
                    </View>
                    <Text className="font-bold text-slate-700 dark:text-slate-300 text-[12px]">
                      reste {formatMontant(num(l.resteDu))} F
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* Montant */}
          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
            Montant reçu (FCFA)
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
          {montant !== '' && !saisie.ok ? (
            <Text className="text-[11px] text-red-600 dark:text-red-400 mt-1">{saisie.erreur}</Text>
          ) : null}
          {resteCoche > 0 ? (
            <View className="flex-row gap-2 mt-2 flex-wrap">
              <Pressable
                onPress={() => setMontant(String(resteCoche))}
                className="bg-emerald-100 dark:bg-emerald-500/15 px-3 py-1.5 rounded-md active:opacity-70"
              >
                <Text className="text-emerald-700 dark:text-emerald-400 text-[11px] font-bold">
                  {`Reste dû coché (${formatMontant(resteCoche)})`}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View className="mt-4">
            <DatePickerField
              label="Date encaissement"
              value={dateEncaissement}
              onChange={setDateEncaissement}
              maximumDate={new Date()}
              optional
            />
          </View>

          {/* Aperçu serveur : répartition, écart, surplus */}
          {apercuPayload ? (
            <View className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md p-4 mt-5">
              <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Aperçu
              </Text>
              {!apercuAJour ? (
                <ActivityIndicator color="#10b981" />
              ) : qApercu.isError ? (
                <Text className="text-[12px] text-red-600 dark:text-red-400">
                  {extractApiErrorMessage(qApercu.error, 'Aperçu indisponible')}
                </Text>
              ) : !apercu ? (
                <ActivityIndicator color="#10b981" />
              ) : (
                <>
                  {apercu.repartition.map((r) => (
                    <View key={r.livraisonId} className="mb-2">
                      <View className="flex-row justify-between">
                        <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                          {r.reference}
                        </Text>
                        <Text className="text-[12px] font-bold text-slate-700 dark:text-slate-300">
                          {formatMontant(num(r.part))} F · reste {formatMontant(num(r.resteDuApres))}
                        </Text>
                      </View>
                      {num(r.part) === 0 ? (
                        <Text className="text-[11px] text-amber-700 dark:text-amber-400">
                          Cette livraison ne reçoit rien : le montant est épuisé par les plus anciennes.
                        </Text>
                      ) : null}
                    </View>
                  ))}
                  <View className="border-t border-slate-100 dark:border-slate-800 pt-2 mt-1">
                    <Ligne label="Reste dû des livraisons cochées" valeur={`${formatMontant(num(apercu.duChoisi))} F`} />
                    <View className="flex-row justify-between mb-2">
                      <Text className="text-slate-500 dark:text-slate-400 text-[12px]">Écart</Text>
                      <Text className={`font-bold ${COULEUR_ECART[tonEcart(num(apercu.ecart))]}`}>
                        {libelleEcart(num(apercu.ecart))}
                      </Text>
                    </View>
                    <Ligne label="Solde du client après" valeur={libelleDetteApres(num(apercu.soldeApres))} />
                  </View>
                  {surplus.length > 0 ? (
                    <Text className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Le surplus couvrira :{' '}
                      {surplus.map((s) => `${s.reference} (${formatMontant(num(s.part))})`).join(', ')}
                    </Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          <Text className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 mt-5 mb-2">
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

          <Pressable
            onPress={onSubmit}
            disabled={desactive}
            className={`rounded-md py-3.5 mt-6 items-center ${
              desactive
                ? 'bg-slate-200 dark:bg-slate-800'
                : 'bg-emerald-500 active:opacity-80'
            }`}
          >
            {m.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text
                className={`font-bold text-base ${
                  desactive ? 'text-slate-400' : 'text-white'
                }`}
              >
                {!isOnline
                  ? 'Hors ligne — réessaye en ligne'
                  : livraisonIds.length === 0
                  ? 'Coche au moins une livraison'
                  : montantSaisi <= 0
                  ? 'Saisis un montant'
                  : `Encaisser ${formatMontant(montantSaisi)} FCFA`}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View className="flex-row justify-between mb-2">
      <Text className="text-slate-500 dark:text-slate-400 text-[12px]">{label}</Text>
      <Text className="font-bold text-slate-700 dark:text-slate-300">{valeur}</Text>
    </View>
  );
}
